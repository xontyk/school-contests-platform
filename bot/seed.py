"""
seed.py — демо-данные для показа на защите.

Создаёт через Supabase Auth Admin API учителя, учеников и две заявки
на регистрацию (пароли хеширует сам Supabase), затем конкурсы, участия,
достижения в разных статусах и историю начислений.

Запуск (один раз, после выполнения supabase/schema.sql):
    python seed.py           — создать, если база ещё пустая
    python seed.py --reset   — удалить конкурсы/достижения и создать заново
                               (аккаунты не удаляются, только обновляются)
"""

from __future__ import annotations

import asyncio
import sys

from db import Db

TEACHER_PASSWORD = "teacher123"
STUDENT_PASSWORD = "demo1234"

TEACHERS = [("teacher@lyceum.ru", "Соколова", "Ольга", "Сергеевна")]
STUDENTS = [
    ("petr@lyceum.ru", "Иванов", "Пётр", "Андреевич", "11А"),
    ("anna@lyceum.ru", "Смирнова", "Анна", "Игоревна", "10Б"),
    ("danil@lyceum.ru", "Кузнецов", "Данил", "Олегович", "11А"),
    ("maria@lyceum.ru", "Лебедева", "Мария", "Павловна", "9Б"),
    ("timur@lyceum.ru", "Орлов", "Тимур", "Русланович", "10А"),
    ("eva@lyceum.ru", "Волкова", "Ева", "Дмитриевна", "9Б"),
]
PENDING = [
    ("novikova@lyceum.ru", "Новикова", "Светлана", "Игоревна", "9А"),
    ("belov@lyceum.ru", "Белов", "Максим", "Сергеевич", "10Б"),
]

NOW = "2026/2027, I четверть"
SPRING = "2025/2026, IV четверть"
WINTER = "2025/2026, III четверть"

CONTESTS = [
    dict(title="Олимпиада по физике: школьный этап", description="Механика, термодинамика и электричество. 9–11 классы.",
         category="olympiad", subject="physics", level="school", period=NOW, start_date="2026-09-20", end_date="2026-10-05", status="finished"),
    dict(title="Муниципальная олимпиада по математике", description="Второй этап ВсОШ. Пропуск — призовое место в школьном этапе.",
         category="olympiad", subject="math", level="municipal", period=NOW, start_date="2026-10-15", end_date="2026-11-20", status="active"),
    dict(title="Хакатон «Код лицея»", description="24 часа, команды по 3 человека, веб-сервисы для школы.",
         category="project", subject="cs", level="city", period=NOW, start_date="2026-10-23", end_date="2026-10-24", status="active"),
    dict(title="Региональная олимпиада по информатике", description="Алгоритмы и структуры данных, 5 задач за 5 часов.",
         category="olympiad", subject="cs", level="regional", period="2026/2027, II четверть", start_date="2026-12-10", end_date="2027-01-25", status="upcoming"),
    dict(title="Конференция «Шаг в науку»", description="Исследовательские проекты по физике и математике.",
         category="project", subject="physics", level="school", period=SPRING, start_date="2026-04-10", end_date="2026-04-20", status="finished"),
]

# (email, категория, предмет, название, уровень, место, часы, период, дата, статус, комментарий)
ACHIEVEMENTS = [
    ("petr@lyceum.ru", "olympiad", "physics", "Региональная олимпиада по физике", "regional", "1", None, SPRING, "2026-04-02", "approved", "Отличный результат!"),
    ("petr@lyceum.ru", "olympiad", "math", "Городская олимпиада по математике", "municipal", "2", None, WINTER, "2026-02-14", "approved", ""),
    ("petr@lyceum.ru", "volunteer", None, "Помощь на Дне открытых дверей", None, None, 10, NOW, "2026-10-03", "approved", "Спасибо!"),
    ("petr@lyceum.ru", "project", None, "Городской конкурс «Юный исследователь»", "city", "2", None, NOW, "2026-10-12", "approved", "Сильная работа"),
    ("petr@lyceum.ru", "project", "cs", "Проект «Трекер привычек» на Python", "school", "participant", None, NOW, "2026-10-20", "pending", ""),
    ("anna@lyceum.ru", "olympiad", "physics", "Школьный этап олимпиады по физике", "school", "1", None, SPRING, "2026-03-10", "approved", ""),
    ("anna@lyceum.ru", "academic", "math", "Призёр научной конференции", None, None, None, NOW, "2026-10-10", "pending", ""),
    ("anna@lyceum.ru", "volunteer", None, "Экологический субботник", None, None, 14, NOW, "2026-09-26", "approved", ""),
    ("danil@lyceum.ru", "olympiad", "cs", "Всероссийская олимпиада по информатике", "national", "3", None, SPRING, "2026-04-18", "approved", "Высокий уровень!"),
    ("danil@lyceum.ru", "project", "physics", "Городской конкурс инженерных проектов", "city", "2", None, NOW, "2026-10-08", "approved", ""),
    ("danil@lyceum.ru", "volunteer", None, "Шахматный турнир для младших", None, None, 6, NOW, "2026-10-11", "rejected", "Нужно подтверждение от организатора"),
    ("maria@lyceum.ru", "olympiad", "math", "Школьный этап олимпиады по математике", "school", "2", None, NOW, "2026-10-01", "approved", ""),
    ("maria@lyceum.ru", "academic", "physics", "Лучшая лабораторная работа четверти", None, None, None, NOW, "2026-10-17", "revoked", "Начислено по ошибке другому ученику"),
    ("timur@lyceum.ru", "olympiad", "physics", "Муниципальная олимпиада по физике", "municipal", "1", None, WINTER, "2026-01-20", "approved", ""),
    ("timur@lyceum.ru", "academic", "cs", "Лучший учебный проект по информатике", None, None, None, NOW, "2026-10-19", "pending", ""),
    ("eva@lyceum.ru", "volunteer", None, "Волонтёр городского научного фестиваля", None, None, 20, NOW, "2026-09-28", "approved", "Максимум за одну заявку"),
    ("eva@lyceum.ru", "olympiad", "cs", "Школьный этап олимпиады по информатике", "school", "3", None, NOW, "2026-10-06", "approved", ""),
]

# Участия: (email, индекс конкурса, результат). Призовые места получают награду.
PARTICIPATIONS = [
    ("petr@lyceum.ru", 0, "1"), ("anna@lyceum.ru", 0, "2"), ("danil@lyceum.ru", 0, "participant"),
    ("timur@lyceum.ru", 0, "3"), ("maria@lyceum.ru", 0, "absent"),
    ("petr@lyceum.ru", 1, "registered"), ("maria@lyceum.ru", 1, "registered"),
    ("danil@lyceum.ru", 2, "registered"), ("eva@lyceum.ru", 2, "registered"),
    ("anna@lyceum.ru", 4, "2"), ("petr@lyceum.ru", 4, "participant"),
]


async def ensure_user(db: Db, email: str, password: str) -> str:
    r = await db.http.post("/auth/v1/admin/users", json={"email": email, "password": password, "email_confirm": True})
    if r.status_code in (200, 201):
        return r.json()["id"]
    page = await db.http.get("/auth/v1/admin/users", params={"page": 1, "per_page": 1000})
    page.raise_for_status()
    for u in page.json()["users"]:
        if u["email"] == email:
            await db.http.put(f"/auth/v1/admin/users/{u['id']}", json={"password": password})
            return u["id"]
    r.raise_for_status()
    raise RuntimeError(f"не удалось создать {email}")


async def calc_points(db: Db, category: str, level: str | None, place: str | None, hours: int | None) -> int:
    return await db.rpc("calc_points", {"p_category": category, "p_level": level, "p_place": place, "p_hours": hours})


async def main() -> None:
    reset = "--reset" in sys.argv
    db = Db()
    try:
        existing = await db.select("contests", {"select": "id", "limit": "1"})
        if existing and not reset:
            print("Демо-данные уже есть. Чтобы пересоздать: python seed.py --reset")
            return
        if reset:
            for table in ("participations", "award_log", "achievements", "contests"):
                r = await db.http.delete(f"/rest/v1/{table}", params={"id": "gt.0"})
                r.raise_for_status()
            print("Конкурсы, участия и достижения удалены.")

        ids: dict[str, str] = {}
        teacher_id = None
        for email, last, first, middle in TEACHERS:
            uid = await ensure_user(db, email, TEACHER_PASSWORD)
            await db.update("profiles", {"id": f"eq.{uid}"}, dict(last_name=last, first_name=first, middle_name=middle,
                            role="teacher", status="approved", registration_completed=True, class_name=None))
            ids[email] = teacher_id = uid
        for email, last, first, middle, klass in STUDENTS:
            uid = await ensure_user(db, email, STUDENT_PASSWORD)
            await db.update("profiles", {"id": f"eq.{uid}"}, dict(last_name=last, first_name=first, middle_name=middle,
                            class_name=klass, role="student", status="approved", registration_completed=True,
                            decided_by=teacher_id))
            ids[email] = uid
        for email, last, first, middle, klass in PENDING:
            uid = await ensure_user(db, email, STUDENT_PASSWORD)
            await db.update("profiles", {"id": f"eq.{uid}"}, dict(last_name=last, first_name=first, middle_name=middle,
                            class_name=klass, role=None, status="pending", registration_completed=True))
        print(f"Аккаунты: {len(TEACHERS)} учитель, {len(STUDENTS)} учеников, {len(PENDING)} заявки в очереди.")

        for (email, cat, subj, title, level, place, hours, period, day, status, comment) in ACHIEVEMENTS:
            pts = await calc_points(db, cat, level, place, hours)
            row = await db.insert("achievements", dict(
                user_id=ids[email], category=cat, subject=subj, title=title, level=level, place=place, hours=hours,
                period=period, date=day, points=pts, status=status, teacher_comment=comment, source="student",
                verified_by=None if status == "pending" else teacher_id,
                verified_at=None if status == "pending" else f"{day}T15:00:00Z",
                notified_status=None if status == "pending" else status))
            if status in ("approved", "revoked"):
                await db.insert("award_log", dict(achievement_id=row["id"], action="approved", points_before=pts,
                                                  points_after=pts, reason=comment or None, actor=teacher_id))
            if status == "revoked":
                await db.insert("award_log", dict(achievement_id=row["id"], action="revoked", points_before=pts,
                                                  points_after=0, reason=comment, actor=teacher_id))
            if status == "rejected":
                await db.insert("award_log", dict(achievement_id=row["id"], action="rejected", points_before=pts,
                                                  points_after=pts, reason=comment, actor=teacher_id))

        contest_rows = []
        for c in CONTESTS:
            contest_rows.append(await db.insert("contests", {**c, "created_by": teacher_id}))
        for email, idx, result in PARTICIPATIONS:
            c = contest_rows[idx]
            part = await db.insert("participations", dict(contest_id=c["id"], user_id=ids[email], result=result))
            if result in ("participant", "3", "2", "1"):
                pts = await calc_points(db, c["category"], c["level"], result, None)
                ach = await db.insert("achievements", dict(
                    user_id=ids[email], category=c["category"], subject=c["subject"], title=c["title"], level=c["level"],
                    place=result, period=c["period"], date=c["end_date"], points=pts, status="approved",
                    teacher_comment="Результат конкурса", source="contest", participation_id=part["id"],
                    verified_by=teacher_id, verified_at=f"{c['end_date']}T18:00:00Z", notified_status="approved"))
                await db.update("participations", {"id": f"eq.{part['id']}"}, {"achievement_id": ach["id"]})
                await db.insert("award_log", dict(achievement_id=ach["id"], action="awarded", points_before=0,
                                                  points_after=pts, reason="Результат конкурса", actor=teacher_id))
        print(f"Конкурсов: {len(CONTESTS)}, участий: {len(PARTICIPATIONS)}, достижений: {len(ACHIEVEMENTS)} + призовые.")
        print("Готово. Вход: teacher@lyceum.ru / teacher123, petr@lyceum.ru / demo1234")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
