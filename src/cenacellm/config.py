from pathlib import Path

def find_project_root(start_path: Path, marker_file: str = "pyproject.toml") -> Path:
    current = start_path.resolve()
    while not (current / marker_file).exists() and current != current.parent:
        current = current.parent
    return current

BASE_DIR = find_project_root(Path(__file__))
VECTORS_DIR = BASE_DIR / "datos" / "vectorstores"
HISTORY_FILE = BASE_DIR / "datos" / "historial.json"
PROCESSED_FILES = BASE_DIR / "datos" / "processed_files.json"
