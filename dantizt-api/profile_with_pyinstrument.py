from pyinstrument import Profiler
from app.main import app
import uvicorn
import os
import time

def profile_app():
    # Создаем директорию для отчетов, если она не существует
    os.makedirs("profiling_reports", exist_ok=True)
    
    # Создаем профилировщик
    profiler = Profiler()
    profiler.start()
    
    # Запускаем приложение с таймаутом
    print("Запуск приложения для профилирования...")
    print("Нажмите Ctrl+C через 30-60 секунд для остановки и генерации отчета")
    
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except KeyboardInterrupt:
        pass
    finally:
        # Останавливаем профилировщик
        profiler.stop()
        
        # Генерируем отчеты в разных форматах
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        
        # HTML отчет (наиболее информативный)
        html_output = f"profiling_reports/profile_report_{timestamp}.html"
        with open(html_output, "w", encoding="utf-8") as f:
            f.write(profiler.output_html())
        
        # Текстовый отчет (для быстрого просмотра)
        text_output = f"profiling_reports/profile_report_{timestamp}.txt"
        with open(text_output, "w", encoding="utf-8") as f:
            f.write(profiler.output_text(unicode=True, color=False))
        
        print(f"\nПрофилирование завершено!")
        print(f"HTML отчет сохранен в: {html_output}")
        print(f"Текстовый отчет сохранен в: {text_output}")
        
        # Выводим текстовый отчет в консоль для быстрого просмотра
        print("\nКраткий отчет профилирования:")
        print(profiler.output_text(unicode=True, color=True))

if __name__ == "__main__":
    profile_app()
