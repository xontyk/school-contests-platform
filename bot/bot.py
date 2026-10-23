"""
bot.py — Telegram-бот «Портал достижений лицея» (@achievementsportal_bot).

Что умеет (по ТЗ для 9–11 классов):
  * /start <код> — привязать Telegram к аккаунту (код выдаёт кнопка на сайте);
  * /rating      — моё место в рейтинге лицея и класса, баллы по направлениям;
  * /add         — добавить достижение пошагово (уходит учителю на проверку);
  * /portfolio   — сводка подтверждённых достижений по категориям;
  * /contests    — афиша открытых конкурсов;
  * уведомления — бот сам пишет, когда учитель подтвердил, отклонил
    или отозвал достижение (опрос базы раз в 15 секунд).

Запуск:  python bot.py   (ключи — в bot/.env, см. README)

ПОДСКАЗКА: что поменять → что изменится в боте
  * POLL_SECONDS          — как часто бот проверяет решения учителя (уведомления);
  * MENU                  — кнопки под полем ввода в Telegram;
  * cmd_start / cmd_rating / cmd_portfolio / cmd_contests — тексты ответов на команды;
  * add_* (AddFlow)       — шаги диалога «Добавить достижение»;
  * set_my_commands в main() — список команд в меню «/» Telegram.
После правок бота нужно перезапустить (Ctrl+C и снова python bot.py).
"""

from __future__ import annotations

import asyncio
import html
import logging
import os
from datetime import date

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (BotCommand, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup,
                           KeyboardButton, Message, ReplyKeyboardMarkup)
from dotenv import load_dotenv

from db import Db

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
SITE_URL = os.environ.get("SITE_URL", "").strip()
POLL_SECONDS = 15  # раз в 15 секунд бот ищет новые решения учителя и присылает уведомления

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bot")

db = Db()
router = Router()

SUBJECTS = {"physics": "Физика", "math": "Математика", "cs": "Информатика"}
CATEGORIES = {"academic": "Академическое", "olympiad": "Олимпиада", "project": "Проект", "volunteer": "Волонтёрство"}
LEVELS = {
    "olympiad": {"school": "Школьный", "municipal": "Муниципальный", "regional": "Региональный",
                 "national": "Всероссийский", "international": "Международный"},
    "project": {"school": "Школьный", "city": "Городской", "regional": "Региональный"},
}
PLACES = {"participant": "Участие", "3": "3 место", "2": "2 место", "1": "1 место"}
STATUS_TEXT = {"approved": "подтверждено", "rejected": "отклонено", "revoked": "отозвано", "pending": "на проверке"}

# кнопки-меню внизу чата; текст кнопки должен совпадать с F.text == "..." у обработчика
MENU = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="Мой рейтинг"), KeyboardButton(text="Добавить достижение")],
              [KeyboardButton(text="Портфолио"), KeyboardButton(text="Конкурсы")]],
    resize_keyboard=True,
)


def esc(text: object) -> str:
    return html.escape(str(text or ""))


def kb(options: dict[str, str], prefix: str, columns: int = 2) -> InlineKeyboardMarkup:
    buttons = [InlineKeyboardButton(text=label, callback_data=f"{prefix}:{key}") for key, label in options.items()]
    rows = [buttons[i:i + columns] for i in range(0, len(buttons), columns)]
    rows.append([InlineKeyboardButton(text="Отмена", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def period_of(d: date) -> str:
    """Учебный год и четверть — та же логика, что periodOf() на сайте."""
    year = f"{d.year}/{d.year + 1}" if d.month >= 9 else f"{d.year - 1}/{d.year}"
    q = "I" if d.month in (9, 10) else "II" if d.month >= 11 else "III" if d.month <= 3 else "IV"
    return f"{year}, {q} четверть"


async def require_profile(message: Message) -> dict | None:
    profile = await db.profile_by_chat(message.chat.id)
    if not profile:
        await message.answer(
            "Аккаунт ещё не привязан.\n\nВойдите на сайт, откройте «Моя карта» → <b>Подключить Telegram</b> — "
            f"бот привяжется автоматически.\n{esc(SITE_URL)}")
        return None
    return profile


# ---------------------------------------------------------------- /start
@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject) -> None:
    if command.args:
        profile = await db.link_chat(command.args, message.chat.id)
        if not profile:
            await message.answer("Код не подошёл: он одноразовый и действует после одобрения заявки. "
                                 "Нажмите «Подключить Telegram» на сайте ещё раз.")
            return
        await message.answer(f"Готово, {esc(profile['first_name'])}! Telegram привязан к порталу.\n"
                             "Буду присылать решения учителя по вашим достижениям.", reply_markup=MENU)
        return
    profile = await db.profile_by_chat(message.chat.id)
    if profile:
        await message.answer(f"С возвращением, {esc(profile['first_name'])}! Что посмотрим?", reply_markup=MENU)
    else:
        await require_profile(message)


# ---------------------------------------------------------------- /rating
@router.message(Command("rating"))
@router.message(F.text == "Мой рейтинг")
async def cmd_rating(message: Message) -> None:
    profile = await require_profile(message)
    if not profile:
        return
    school = await db.rating()
    me = next((i for i, r in enumerate(school) if r["user_id"] == profile["id"]), None)
    if me is None:
        await message.answer("Рейтинг доступен ученикам.")
        return
    row = school[me]
    klass = await db.rating(profile["class_name"]) if profile.get("class_name") else []
    class_place = next((i + 1 for i, r in enumerate(klass) if r["user_id"] == profile["id"]), None)
    top = "\n".join(f"{i + 1}. {esc(r['full_name'])} ({esc(r['class_name'])}) — <b>{r['total']}</b>"
                    for i, r in enumerate(school[:5]))
    await message.answer(
        f"<b>Ваш рейтинг</b>\n"
        f"Место в лицее: <b>{me + 1}</b> из {len(school)}\n"
        + (f"Место в классе {esc(profile['class_name'])}: <b>{class_place}</b> из {len(klass)}\n" if class_place else "")
        + f"\nВсего баллов: <b>{row['total']}</b>\n"
        f"Физика: {row['physics']} · Математика: {row['math']} · Информатика: {row['cs']}\n\n"
        f"<b>Топ-5 лицея</b>\n{top}")


# ---------------------------------------------------------------- /portfolio
@router.message(Command("portfolio"))
@router.message(F.text == "Портфолио")
async def cmd_portfolio(message: Message) -> None:
    profile = await require_profile(message)
    if not profile:
        return
    items = await db.my_achievements(profile["id"])
    approved = [a for a in items if a["status"] == "approved"]
    pending = sum(1 for a in items if a["status"] == "pending")
    lines = [f"{label}: {sum(1 for a in approved if a['category'] == key)} шт., "
             f"{sum(a['points'] for a in approved if a['category'] == key)} баллов" for key, label in CATEGORIES.items()]
    recent = "\n".join(f"• {esc(a['title'])} — +{a['points']}" for a in approved[:5]) or "пока пусто"
    await message.answer("<b>Портфолио</b>\n" + "\n".join(lines) +
                         f"\n\nНа проверке: {pending}\n\n<b>Последние подтверждённые</b>\n{recent}")


# ---------------------------------------------------------------- /contests
@router.message(Command("contests"))
@router.message(F.text == "Конкурсы")
async def cmd_contests(message: Message) -> None:
    contests = await db.open_contests()
    if not contests:
        await message.answer("Открытых конкурсов сейчас нет.")
        return
    text = "\n\n".join(
        f"<b>{esc(c['title'])}</b>\n{SUBJECTS.get(c['subject'] or '', 'Общее')} · "
        f"{LEVELS.get(c['category'], {}).get(c['level'], '')} · до {esc(c['end_date'] or '—')}"
        for c in contests)
    await message.answer(f"<b>Афиша конкурсов</b>\n\n{text}\n\nЗаявку подайте на сайте: {esc(SITE_URL)}")


# ---------------------------------------------------------------- /add (пошагово)
class AddFlow(StatesGroup):
    category = State()
    subject = State()
    level = State()
    place = State()
    hours = State()
    title = State()
    confirm = State()


@router.message(Command("add"))
@router.message(F.text == "Добавить достижение")
async def add_start(message: Message, state: FSMContext) -> None:
    profile = await require_profile(message)
    if not profile:
        return
    if profile["role"] != "student":
        await message.answer("Добавлять достижения себе могут ученики. Учитель начисляет баллы на сайте.")
        return
    await state.clear()
    await state.update_data(user_id=profile["id"])
    await state.set_state(AddFlow.category)
    await message.answer("Какая категория?", reply_markup=kb(CATEGORIES, "cat"))


@router.callback_query(F.data == "cancel")
async def add_cancel(cb: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await cb.message.edit_text("Отменено.")


@router.callback_query(AddFlow.category, F.data.startswith("cat:"))
async def add_category(cb: CallbackQuery, state: FSMContext) -> None:
    category = cb.data.split(":", 1)[1]
    await state.update_data(category=category)
    await state.set_state(AddFlow.subject)
    await cb.message.edit_text(f"Категория: <b>{CATEGORIES[category]}</b>\nПредмет?",
                               reply_markup=kb({**SUBJECTS, "none": "Общее"}, "subj"))


@router.callback_query(AddFlow.subject, F.data.startswith("subj:"))
async def add_subject(cb: CallbackQuery, state: FSMContext) -> None:
    subject = cb.data.split(":", 1)[1]
    await state.update_data(subject=None if subject == "none" else subject)
    data = await state.get_data()
    if data["category"] in LEVELS:
        await state.set_state(AddFlow.level)
        await cb.message.edit_text("Уровень?", reply_markup=kb(LEVELS[data["category"]], "lvl"))
    elif data["category"] == "volunteer":
        await state.set_state(AddFlow.hours)
        await cb.message.edit_text("Сколько часов волонтёрства? Напишите число.")
    else:
        await state.set_state(AddFlow.title)
        await cb.message.edit_text("Как называется достижение? Напишите одним сообщением.")


@router.callback_query(AddFlow.level, F.data.startswith("lvl:"))
async def add_level(cb: CallbackQuery, state: FSMContext) -> None:
    await state.update_data(level=cb.data.split(":", 1)[1])
    await state.set_state(AddFlow.place)
    await cb.message.edit_text("Результат?", reply_markup=kb(PLACES, "place"))


@router.callback_query(AddFlow.place, F.data.startswith("place:"))
async def add_place(cb: CallbackQuery, state: FSMContext) -> None:
    await state.update_data(place=cb.data.split(":", 1)[1])
    await state.set_state(AddFlow.title)
    await cb.message.edit_text("Как называется олимпиада или проект? Напишите одним сообщением.")


@router.message(AddFlow.hours)
async def add_hours(message: Message, state: FSMContext) -> None:
    if not (message.text or "").isdigit() or not 0 < int(message.text) <= 500:
        await message.answer("Нужно целое число часов, например 6.")
        return
    await state.update_data(hours=int(message.text))
    await state.set_state(AddFlow.title)
    await message.answer("Как называется достижение?")


@router.message(AddFlow.title)
async def add_title(message: Message, state: FSMContext) -> None:
    title = (message.text or "").strip()
    if not 3 <= len(title) <= 160:
        await message.answer("Название — от 3 до 160 символов.")
        return
    await state.update_data(title=title)
    data = await state.get_data()
    await state.set_state(AddFlow.confirm)
    details = [CATEGORIES[data["category"]], SUBJECTS.get(data.get("subject") or "", "Общее")]
    if data.get("level"):
        details += [LEVELS[data["category"]][data["level"]], PLACES[data["place"]]]
    if data.get("hours"):
        details.append(f"{data['hours']} ч")
    confirm = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Отправить учителю", callback_data="send"),
                                                     InlineKeyboardButton(text="Отмена", callback_data="cancel")]])
    await message.answer(f"<b>{esc(title)}</b>\n{' · '.join(details)}\n\nОтправить на проверку?", reply_markup=confirm)


@router.callback_query(AddFlow.confirm, F.data == "send")
async def add_send(cb: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    today = date.today()
    row = await db.submit_achievement(data["user_id"], {
        "category": data["category"], "subject": data.get("subject"), "title": data["title"],
        "level": data.get("level"), "place": data.get("place"), "hours": data.get("hours"),
        "date": today.isoformat(), "period": period_of(today),
    })
    await state.clear()
    await cb.message.edit_text(f"Отправлено учителю. По таблице это <b>{row['points']}</b> баллов — "
                               "они попадут в рейтинг после подтверждения. Я напишу, когда учитель решит.")


# ---------------------------------------------------------------- уведомления
async def notifier(bot: Bot) -> None:  # фоновая задача: решения учителя → сообщения ученикам
    """Раз в POLL_SECONDS проверяет новые решения учителя и пишет ученику."""
    while True:
        try:
            for a in await db.undelivered_decisions():
                chat_id = a["profiles"]["telegram_chat_id"]
                status = a["status"]
                if status == "approved":
                    head = "Награда начислена" if a["source"] == "contest" else "Достижение подтверждено"
                    text = f"<b>{head}</b>\n{esc(a['title'])}\n+{a['points']} баллов в рейтинг."
                elif status == "rejected":
                    text = f"<b>Достижение отклонено</b>\n{esc(a['title'])}\nКомментарий учителя: {esc(a['teacher_comment'])}"
                else:
                    text = f"<b>Награда отозвана</b>\n{esc(a['title'])}\n−{a['points']} баллов. Причина: {esc(a['teacher_comment'])}"
                try:
                    await bot.send_message(chat_id, text)
                except Exception as send_error:  # пользователь заблокировал бота и т.п.
                    log.warning("не удалось отправить %s: %s", chat_id, send_error)
                await db.mark_delivered(a["id"], status)
        except Exception as error:
            log.warning("ошибка опроса базы: %s", error)
        await asyncio.sleep(POLL_SECONDS)


async def main() -> None:
    if not TOKEN:
        raise SystemExit("В bot/.env не заполнен TELEGRAM_BOT_TOKEN")
    bot = Bot(TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)
    await bot.set_my_commands([
        BotCommand(command="rating", description="Моё место в рейтинге"),
        BotCommand(command="add", description="Добавить достижение"),
        BotCommand(command="portfolio", description="Портфолио"),
        BotCommand(command="contests", description="Афиша конкурсов"),
    ])
    poller = asyncio.create_task(notifier(bot))
    log.info("бот запущен")
    try:
        await dp.start_polling(bot)
    finally:
        poller.cancel()
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
