"""
admin.py — служебные команды для владельца портала (ключ service_role из bot/.env).

    python admin.py teacher EMAIL "Фамилия Имя Отчество"
        Создать учителя (или сделать учителем существующий аккаунт) без письма.
        Пароль спрашивается в терминале и нигде не сохраняется.

    python admin.py clear-demo
        Удалить демо-аккаунты *@lyceum.ru из seed.py вместе с их достижениями,
        заявками и конкурсами, которые создал демо-учитель.
"""

from __future__ import annotations

import asyncio
import getpass
import sys

from db import Db
from seed import ensure_user

DEMO_DOMAIN = "@lyceum.ru"


async def make_teacher(email: str, full_name: str) -> None:
    email = email.strip().lower()
    parts = full_name.split()
    if len(parts) < 2:
        raise SystemExit("Укажите ФИО в кавычках: \"Фамилия Имя Отчество\"")
    password = getpass.getpass("Пароль (не отображается): ")
    if len(password) < 6:
        raise SystemExit("Пароль должен быть не короче 6 символов.")
    if getpass.getpass("Повторите пароль: ") != password:
        raise SystemExit("Пароли не совпадают.")
    db = Db()
    try:
        uid = await ensure_user(db, email, password)
        await db.update("profiles", {"id": f"eq.{uid}"}, dict(
            last_name=parts[0], first_name=parts[1], middle_name=" ".join(parts[2:]),
            role="teacher", status="approved", registration_completed=True,
            class_name=None, rejection_reason=None))
        print(f"Готово: {email} — учитель. Входите на сайте по e-mail и паролю.")
    finally:
        await db.close()


async def clear_demo() -> None:
    db = Db()
    try:
        page = await db.http.get("/auth/v1/admin/users", params={"page": 1, "per_page": 1000})
        page.raise_for_status()
        demo = [u["id"] for u in page.json()["users"] if (u.get("email") or "").endswith(DEMO_DOMAIN)]
        if not demo:
            print("Демо-аккаунтов нет.")
            return
        ids = f"in.({','.join(demo)})"
        # конкурсы демо-учителя удаляем, а ссылки на демо-людей в чужих записях обнуляем,
        # иначе внешние ключи не дадут удалить аккаунты
        (await db.http.delete("/rest/v1/contests", params={"created_by": ids})).raise_for_status()
        await db.update("profiles", {"decided_by": ids}, {"decided_by": None})
        await db.update("achievements", {"verified_by": ids}, {"verified_by": None})
        await db.update("award_log", {"actor": ids}, {"actor": None})
        for uid in demo:
            # профиль, достижения, участия и история удаляются каскадом
            (await db.http.delete(f"/auth/v1/admin/users/{uid}")).raise_for_status()
        print(f"Удалено демо-аккаунтов: {len(demo)} (вместе с их достижениями и конкурсами).")
    finally:
        await db.close()


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 3 and args[0] == "teacher":
        asyncio.run(make_teacher(args[1], args[2]))
    elif args == ["clear-demo"]:
        asyncio.run(clear_demo())
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
