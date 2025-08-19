import openai as openai_api
import ollama as ollama_api
from ollama import AsyncClient

from dotenv import load_dotenv
import os

load_dotenv()


#ollama_base_url: str = os.getenv("OLLAMA_BASE_URL")
mongo_uri: str = os.getenv("MONGO_URI")
db_name: str = os.getenv("DB_NAME")

ollama = ollama_api.Client() #(host=ollama_base_url)




