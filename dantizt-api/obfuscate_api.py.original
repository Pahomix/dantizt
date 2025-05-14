#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import random
import string
import ast
import astor
import shutil
from pathlib import Path

# Директории, которые нужно исключить из обфускации
EXCLUDE_DIRS = [
    '__pycache__',
    'venv',
    'env',
    '.git',
    'migrations',
    'tests',
    'alembic'
]

# Файлы, которые нужно исключить из обфускации
EXCLUDE_FILES = [
    '__init__.py',
    'main.py',
    'config.py',
    'settings.py',
    'schemas.py'  # Обычно схемы Pydantic лучше не обфусцировать для сохранения API
]

# Имена, которые не нужно обфусцировать (встроенные функции, методы FastAPI и т.д.)
RESERVED_NAMES = [
    'self', 'cls', 'app', 'router', 'db', 'session', 'request', 'response',
    'fastapi', 'sqlalchemy', 'pydantic', 'datetime', 'timedelta', 'uuid',
    'get', 'post', 'put', 'delete', 'patch', 'options', 'head',
    'APIRouter', 'FastAPI', 'Depends', 'HTTPException', 'status',
    'Query', 'Path', 'Body', 'Form', 'File', 'UploadFile',
    'BaseModel', 'Field', 'validator', 'root_validator',
    'select', 'insert', 'update', 'delete', 'join', 'outerjoin',
    'and_', 'or_', 'not_', 'desc', 'asc', 'func', 'text',
    'AsyncSession', 'sessionmaker', 'relationship', 'backref',
    'Column', 'Integer', 'String', 'Boolean', 'DateTime', 'Float', 'ForeignKey',
    'Base', 'metadata', 'create_engine', 'declarative_base',
    'Optional', 'List', 'Dict', 'Union', 'Any', 'Tuple', 'Set',
    'track_appointment', 'update_doctor_workload', 'track_payment',
    'track_db_query', 'update_active_users'  # Функции метрик, которые не стоит переименовывать
]

# Генерация случайного имени
def generate_random_name(length=8):
    chars = string.ascii_letters + string.digits
    return '_' + ''.join(random.choice(chars) for _ in range(length))

# Класс для обфускации кода
class Obfuscator(ast.NodeTransformer):
    def __init__(self):
        self.name_mapping = {}
        
    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Store) and node.id not in RESERVED_NAMES:
            if node.id not in self.name_mapping:
                self.name_mapping[node.id] = generate_random_name()
            node.id = self.name_mapping[node.id]
        elif isinstance(node.ctx, ast.Load) and node.id in self.name_mapping:
            node.id = self.name_mapping[node.id]
        return node
    
    def visit_FunctionDef(self, node):
        # Не обфусцируем имена специальных методов (начинающиеся и заканчивающиеся двойным подчеркиванием)
        if not (node.name.startswith('__') and node.name.endswith('__')) and node.name not in RESERVED_NAMES:
            if node.name not in self.name_mapping:
                self.name_mapping[node.name] = generate_random_name()
            node.name = self.name_mapping[node.name]
        
        # Обрабатываем аргументы функции
        for arg in node.args.args:
            if arg.arg != 'self' and arg.arg != 'cls' and arg.arg not in RESERVED_NAMES:
                if arg.arg not in self.name_mapping:
                    self.name_mapping[arg.arg] = generate_random_name()
                arg.arg = self.name_mapping[arg.arg]
        
        # Рекурсивно обрабатываем тело функции
        self.generic_visit(node)
        return node
    
    def visit_ClassDef(self, node):
        # Не обфусцируем имена классов, которые наследуются от известных базовых классов
        base_names = [base.id for base in node.bases if isinstance(base, ast.Name)]
        if not any(name in ['BaseModel', 'Base', 'HTTPException'] for name in base_names) and node.name not in RESERVED_NAMES:
            if node.name not in self.name_mapping:
                self.name_mapping[node.name] = generate_random_name()
            node.name = self.name_mapping[node.name]
        
        # Рекурсивно обрабатываем содержимое класса
        self.generic_visit(node)
        return node
    
    def visit_Assign(self, node):
        # Обрабатываем присваивания
        self.generic_visit(node)
        return node
    
    def visit_Import(self, node):
        # Импорты не обфусцируем
        return node
    
    def visit_ImportFrom(self, node):
        # Импорты не обфусцируем
        return node

# Функция для обфускации файла
def obfuscate_file(file_path, output_path=None):
    if output_path is None:
        output_path = file_path
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source_code = f.read()
        
        # Парсим исходный код в AST
        tree = ast.parse(source_code)
        
        # Применяем обфускацию
        obfuscator = Obfuscator()
        obfuscated_tree = obfuscator.visit(tree)
        
        # Удаляем докстринги
        for node in ast.walk(obfuscated_tree):
            if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.Module)):
                if node.body and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Str):
                    node.body.pop(0)
        
        # Генерируем обфусцированный код
        obfuscated_code = astor.to_source(obfuscated_tree)
        
        # Удаляем комментарии и лишние пробелы
        obfuscated_code = re.sub(r'#.*$', '', obfuscated_code, flags=re.MULTILINE)
        obfuscated_code = re.sub(r'\n\s*\n', '\n', obfuscated_code)
        
        # Записываем обфусцированный код
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(obfuscated_code)
        
        print(f"Обфусцирован файл: {file_path}")
        return True
    except Exception as e:
        print(f"Ошибка при обфускации файла {file_path}: {str(e)}")
        return False

# Функция для обфускации всего проекта
def obfuscate_project(src_dir, dest_dir=None):
    if dest_dir is None:
        dest_dir = src_dir + '_obfuscated'
    
    # Создаем директорию для обфусцированного кода, если она не существует
    os.makedirs(dest_dir, exist_ok=True)
    
    # Копируем все файлы из исходной директории
    for root, dirs, files in os.walk(src_dir):
        # Пропускаем исключенные директории
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        # Создаем соответствующую структуру директорий в dest_dir
        rel_path = os.path.relpath(root, src_dir)
        dest_path = os.path.join(dest_dir, rel_path) if rel_path != '.' else dest_dir
        os.makedirs(dest_path, exist_ok=True)
        
        # Обрабатываем файлы
        for file in files:
            if file.endswith('.py') and file not in EXCLUDE_FILES:
                src_file = os.path.join(root, file)
                dest_file = os.path.join(dest_path, file)
                obfuscate_file(src_file, dest_file)
            elif not file.endswith('.pyc'):  # Копируем не-Python файлы без изменений
                src_file = os.path.join(root, file)
                dest_file = os.path.join(dest_path, file)
                shutil.copy2(src_file, dest_file)
                print(f"Скопирован файл: {src_file}")
    
    print(f"\nОбфускация завершена. Обфусцированный код находится в: {dest_dir}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Обфускация Python кода для DantiZT API')
    parser.add_argument('--src', default='dantizt-api', help='Исходная директория проекта')
    parser.add_argument('--dest', default=None, help='Директория для обфусцированного кода')
    parser.add_argument('--file', default=None, help='Обфусцировать только указанный файл')
    
    args = parser.parse_args()
    
    if args.file:
        obfuscate_file(args.file)
    else:
        obfuscate_project(args.src, args.dest)
