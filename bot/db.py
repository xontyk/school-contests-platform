"""
db.py — доступ бота к общей базе Supabase (PostgREST + Auth Admin API).

Бот работает с ключом service_role из bot/.env: он обходит RLS, поэтому
все проверки «кому что можно» здесь делаются явно — бот действует только
от имени пользователя, чей Telegram привязан к профилю. Баллы бот не
считает сам: при вставке триггер prepare_achievement() в базе
принудительно ставит статус «на проверке» и пересчитывает баллы.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
if not SERVICE_KEY:
    raise SystemExit("В bot/.env не заполнен SUPABASE_SERVICE_KEY — см. README, раздел «Telegram-бот».")

_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


class Db:
    def __init__(self) -> None:
        self.http = httpx.AsyncClient(base_url=SUPABASE_URL, headers=_HEADERS, timeout=20)

    async def close(self) -> None:
        await self.http.aclose()

    # ---------- низкоуровневые вызовы ----------
    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        r = await self.http.get(f"/rest/v1/{table}", params=params)
        r.raise_for_status()
        return r.json()

    async def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        r = await self.http.post(f"/rest/v1/{table}", json=row, headers={"Prefer": "return=representation"})
        r.raise_for_status()
        return r.json()[0]

    async def update(self, table: str, filters: dict[str, str], patch: dict[str, Any]) -> list[dict[str, Any]]:
        r = await self.http.patch(f"/rest/v1/{table}", params=filters, json=patch, headers={"Prefer": "return=representation"})
        r.raise_for_status()
        return r.json()

    async def rpc(self, fn: str, args: dict[str, Any]) -> Any:
        r = await self.http.post(f"/rest/v1/rpc/{fn}", json=args)
        r.raise_for_status()
        return r.json()

    # ---------- профиль и привязка Telegram ----------
    async def profile_by_chat(self, chat_id: int) -> dict[str, Any] | None:
        rows = await self.select("profiles", {"telegram_chat_id": f"eq.{chat_id}", "select": "*"})
        return rows[0] if rows else None

    async def link_chat(self, code: str, chat_id: int) -> dict[str, Any] | None:
        """Привязывает чат по одноразовому коду с сайта; код после этого сгорает."""
        rows = await self.select("profiles", {"telegram_link_code": f"eq.{code.strip().upper()}", "select": "*"})
        if not rows or rows[0]["status"] != "approved":
            return None
        profile = rows[0]
        # один чат — один аккаунт: снимаем старую привязку, если была
        await self.update("profiles", {"telegram_chat_id": f"eq.{chat_id}"}, {"telegram_chat_id": None})
        await self.update("profiles", {"id": f"eq.{profile['id']}"}, {"telegram_chat_id": chat_id, "telegram_link_code": None})
        # прошлые решения считаем уже «доставленными», чтобы не слать старые уведомления
        for status in ("approved", "rejected", "revoked"):
            await self.update("achievements", {"user_id": f"eq.{profile['id']}", "status": f"eq.{status}"}, {"notified_status": status})
        profile["telegram_chat_id"] = chat_id
        return profile

    # ---------- данные для команд ----------
    async def rating(self, class_name: str | None = None) -> list[dict[str, Any]]:
        return await self.rpc("get_rating", {"p_class": class_name, "p_subject": None, "p_period": None})

    async def open_contests(self) -> list[dict[str, Any]]:
        return await self.select("contests", {"status": "neq.finished", "order": "start_date.asc", "select": "*"})

    async def my_achievements(self, user_id: str) -> list[dict[str, Any]]:
        return await self.select("achievements", {"user_id": f"eq.{user_id}", "order": "created_at.desc", "select": "*"})

    async def submit_achievement(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        row = {**data, "user_id": user_id, "source": "telegram"}
        return await self.insert("achievements", row)

    # ---------- уведомления ----------
    async def undelivered_decisions(self) -> list[dict[str, Any]]:
        """Решения учителя, о которых ученик с привязанным Telegram ещё не знает."""
        result: list[dict[str, Any]] = []
        for status in ("approved", "rejected", "revoked"):
            result += await self.select("achievements", {
                "status": f"eq.{status}",
                "or": f"(notified_status.is.null,notified_status.neq.{status})",
                "profiles.telegram_chat_id": "not.is.null",
                "select": "id,title,status,points,teacher_comment,source,profiles!achievements_user_id_fkey!inner(telegram_chat_id)",
                "limit": "50",
            })
        return result

    async def mark_delivered(self, achievement_id: int, status: str) -> None:
        await self.update("achievements", {"id": f"eq.{achievement_id}"}, {"notified_status": status})
