import os
import random
import string
import ast
import astor
from pathlib import Path

# Путь к файлу, который нужно обфусцировать
AUTH_FILE_PATH = 'app/api/v1/endpoints/auth.py'

def generate_random_name(length=10):
    return '_' + ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(length))

class VariableRenamer(ast.NodeTransformer):
    
    def __init__(self):
        self.name_mapping = {}
        self.skip_names = {
            'self', 'cls', 'True', 'False', 'None', 'Exception', 
            'APIRouter', 'Depends', 'HTTPException', 'status', 'Response',
            'OAuth2PasswordRequestForm', 'AsyncSession', 'select',
            'router', 'login', 'register', 'verify_email', 'refresh_token',
            'read_users_me', 'logout',
            'str', 'int', 'bool', 'list', 'dict', 'set', 'tuple',
            'router.post', 'router.get',
            'User', 'UserRole', 'Patient', 'BaseModel', 'EmailStr', 'constr',
            'email', 'password', 'full_name', 'phone_number', 'token',
            'access_token', 'refresh_token', 'message'
        }
    
    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Store) and node.id not in self.skip_names:
            if node.id not in self.name_mapping:
                self.name_mapping[node.id] = generate_random_name()
            node.id = self.name_mapping[node.id]
        elif isinstance(node.ctx, ast.Load) and node.id in self.name_mapping:
            node.id = self.name_mapping[node.id]
        return node
    
    def visit_FunctionDef(self, node):
        if node.name not in self.skip_names:
            if node.name not in self.name_mapping:
                self.name_mapping[node.name] = generate_random_name()
            node.name = self.name_mapping[node.name]

        for arg in node.args.args:
            if arg.arg not in self.skip_names:
                if arg.arg not in self.name_mapping:
                    self.name_mapping[arg.arg] = generate_random_name()
                arg.arg = self.name_mapping[arg.arg]
        
        for i, item in enumerate(node.body):
            node.body[i] = self.visit(item)
        
        return node

def obfuscate_auth_file():
    # Получаем абсолютный путь к корню проекта
    project_root = Path(__file__).parent
    auth_file_path = project_root / AUTH_FILE_PATH
    
    if not auth_file_path.exists():
        print(f"Файл {auth_file_path} не найден!")
        return
    backup_dir = project_root / "backups"
    backup_dir.mkdir(exist_ok=True)
    
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backup_dir / f"auth.py.{timestamp}.bak"
    
    with open(auth_file_path, "r", encoding="utf-8") as f:
        original_code = f.read()
    
    with open(backup_file, "w", encoding="utf-8") as f:
        f.write(original_code)
    
    print(f"Создана резервная копия: {backup_file}")
    
    # Парсим исходный код в AST
    try:
        tree = ast.parse(original_code)
    except SyntaxError as e:
        print(f"Ошибка синтаксиса в файле: {e}")
        return
    
    # Применяем обфускацию
    transformer = VariableRenamer()
    transformed_tree = transformer.visit(tree)
    
    # Генерируем новый код из AST
    new_code = astor.to_source(transformed_tree)
    
    # Сохраняем обфусцированный код
    with open(auth_file_path, "w", encoding="utf-8") as f:
        f.write(new_code)
    
    print(f"Файл {auth_file_path} успешно обфусцирован!")
    print(f"Количество переименованных переменных: {len(transformer.name_mapping)}")
    print("Карта переименований:")
    for original, new_name in transformer.name_mapping.items():
        print(f"  {original} -> {new_name}")

if __name__ == "__main__":
    obfuscate_auth_file()
