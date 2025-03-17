import os
import json
from pathlib import Path

class ChatHistoryManager:
    def __init__(self, history_file=None):
        base_path = Path.home() / "OneDrive/Documents/mcd/proyectoCenace/datos/chat_history"
        self.history_file = history_file or base_path / "history.json"
        self._ensure_history_file()
        self.histories = self.load_history()

    def _ensure_history_file(self):
        """Verifica si el archivo de historial existe, si no, lo crea vacío."""
        if not os.path.exists(self.history_file):
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump({}, f, indent=4, ensure_ascii=False)

    def load_history(self):
        """Carga el historial de conversaciones desde un archivo JSON."""
        with open(self.history_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_history(self):
        """Guarda el historial actualizado en el archivo JSON."""
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(self.histories, f, indent=4, ensure_ascii=False)


    def add_message(self, session_id: str, message_type: str, content: str):
        """Agrega un mensaje al historial y lo guarda."""
        if session_id not in self.histories:
            self.histories[session_id] = []
        
        self.histories[session_id].append({"type": message_type, "content": content})
        self.save_history()
