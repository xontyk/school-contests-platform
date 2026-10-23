"""
admin.py — служебные команды для владельца портала (ключ service_role из bot/.env).

    python admin.py teacher EMAIL ["Фамилия Имя Отчество"]
        Создать учителя (или сделать учителем существующий аккаунт) без письма.
        ФИО (если не указано) и пароль спрашиваются в терминале, пароль нигде не сохраняется.

    python admin.py password EMAIL
        Задать новый пароль любому пользователю без письма (если почта не доходит).
        Пароль спрашивается в терминале.

    python admin.py make-admin EMAIL
        Сделать учителя главным администратором: на сайте у него появится
        «Создать пользователя» и роль «Администратор» в списке.

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


def ask_password() -> str:
    password = getpass.getpass("Пароль (не отображается): ")
    if len(password) < 6:
        raise SystemExit("Пароль должен быть не короче 6 символов.")
    if getpass.getpass("Повторите пароль: ") != password:
        raise SystemExit("Пароли не совпадают.")
    return password


async def find_user_id(db: Db, email: str) -> str | None:
    page = await db.http.get("/auth/v1/admin/users", params={"page": 1, "per_page": 1000})
    page.raise_for_status()
    return next((u["id"] for u in page.json()["users"] if u.get("email") == email), None)


async def set_password(email: str) -> None:
    email = email.strip().lower()
    db = Db()
    try:
        uid = await find_user_id(db, email)
        if not uid:
            raise SystemExit(f"Пользователь {email} не найден.")
        password = ask_password()
        (await db.http.put(f"/auth/v1/admin/users/{uid}", json={"password": password, "email_confirm": True})).raise_for_status()
        print(f"Готово: пароль для {email} изменён.")
    finally:
        await db.close()


async def make_admin(email: str) -> None:
    email = email.strip().lower()
    db = Db()
    try:
        rows = await db.update("profiles", {"email": f"eq.{email}"},
                               {"role": "teacher", "status": "approved", "is_admin": True, "class_name": None})
        if not rows:
            raise SystemExit(f"Пользователь {email} не найден.")
        print(f"Готово: {email} — главный администратор.")
    finally:
        await db.close()


async def make_teacher(email: str, full_name: str) -> None:
    email = email.strip().lower()
    parts = (full_name or input("ФИО (Фамилия Имя Отчество): ")).split()
    if len(parts) < 2:
        raise SystemExit("Укажите ФИО в кавычках: \"Фамилия Имя Отчество\"")
    password = ask_password()
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
    if len(args) in (2, 3) and args[0] == "teacher":
        asyncio.run(make_teacher(args[1], args[2] if len(args) == 3 else ""))
    elif len(args) == 2 and args[0] == "password":
        asyncio.run(set_password(args[1]))
    elif len(args) == 2 and args[0] == "make-admin":
        asyncio.run(make_admin(args[1]))
    elif args == ["clear-demo"]:
        asyncio.run(clear_demo())
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
