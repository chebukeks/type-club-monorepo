import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.database import async_session
from app.models import User
from app.auth import hash_password

async def main():
    async with async_session() as session:
        email = "moderator@type-club.ru"
        nickname = "moderator"
        password = "Moderator123!"

        stmt = select(User).where((User.email == email) | (User.nickname == nickname))
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user:
            user.nickname = nickname
            user.email = email
            user.password_hash = hash_password(password)
            user.email_verified = True
            user.role = "moderator"
            print(f"Updated existing user '{user.nickname}' (ID: {user.id}) to verified moderator.")
        else:
            user = User(
                nickname=nickname,
                email=email,
                password_hash=hash_password(password),
                email_verified=True,
                role="moderator",
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"Created new verified moderator user '{user.nickname}' (ID: {user.id}).")

        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
