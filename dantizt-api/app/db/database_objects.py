from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection
from app.db.views import create_views
from app.db.procedures import create_procedures
from app.db.triggers import create_triggers
import logging

async def execute_sql_commands(conn: AsyncConnection, sql_commands: str) -> None:
    """Выполняет SQL команды по отдельности"""
    if not sql_commands.strip():
        return

    # Разделяем команды, сохраняя целостность процедур и функций
    commands = []
    current_command = []
    in_dollar_quote = False
    dollar_quote_marker = None
    
    for line in sql_commands.split('\n'):
        stripped_line = line.strip()
        
        # Обработка долларных кавычек
        if not in_dollar_quote and stripped_line.startswith('$$'):
            in_dollar_quote = True
            dollar_quote_marker = '$$'
        elif in_dollar_quote and stripped_line.endswith(dollar_quote_marker):
            in_dollar_quote = False
            dollar_quote_marker = None
        
        current_command.append(line)
        
        # Если мы не внутри долларных кавычек и встретили точку с запятой,
        # значит это конец команды
        if not in_dollar_quote and stripped_line.endswith(';'):
            commands.append('\n'.join(current_command))
            current_command = []
    
    # Добавляем последнюю команду, если она есть
    if current_command:
        commands.append('\n'.join(current_command))
    
    # Выполняем каждую команду отдельно
    for i, command in enumerate(commands, 1):
        command = command.strip()
        if not command:
            continue
            
        try:
            logging.debug(f"Command: {command}")
            await conn.execute(text(command))
            logging.debug(f"SQL command {i}/{len(commands)} executed successfully")
        except Exception as e:
            logging.error(f"Error executing SQL command {i}/{len(commands)}")
            logging.error(f"Error details: {str(e)}")
            raise

import logging
from sqlalchemy.ext.asyncio import AsyncConnection
from app.db.triggers import create_triggers
from app.db.views import create_views

async def create_database_objects(conn: AsyncConnection):
    """
    Создает все необходимые объекты базы данных:
    - Триггеры
    - Функции
    - Процедуры
    - Представления
    """
    # Создаем все объекты БД в правильном порядке
    await create_triggers(conn)
    await create_views(conn)
    
    logging.info("Database objects created successfully")
