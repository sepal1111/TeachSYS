from datetime import datetime, date, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
    TAIPEI_TZ = ZoneInfo("Asia/Taipei")
except Exception:
    TAIPEI_TZ = timezone(timedelta(hours=8), name="Asia/Taipei")

def get_now_taipei() -> datetime:
    """Returns current datetime in Taiwan (Asia/Taipei, UTC+8) timezone."""
    return datetime.now(TAIPEI_TZ)

def get_today_taipei() -> date:
    """Returns current date object in Taiwan timezone."""
    return get_now_taipei().date()

def get_today_str_taipei() -> str:
    """Returns current date string (YYYY-MM-DD) in Taiwan timezone."""
    return get_today_taipei().isoformat()

def get_now_str_taipei() -> str:
    """Returns current timestamp string (YYYY-MM-DD HH:MM:SS) in Taiwan timezone."""
    return get_now_taipei().strftime("%Y-%m-%d %H:%M:%S")

def get_today_mmdd_taipei() -> str:
    """Returns today's MMDD string in Taiwan timezone (for password calculation)."""
    return get_today_taipei().strftime("%m%d")
