import cProfile
import pstats
import io
from app.main import app
import uvicorn

def profile_app():
    pr = cProfile.Profile()
    pr.enable()
    
    # Запуск приложения на короткое время
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
    pr.disable()
    s = io.StringIO()
    ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
    ps.print_stats(30)  # Вывод топ-30 самых затратных функций
    print(s.getvalue())

if __name__ == "__main__":
    profile_app()
