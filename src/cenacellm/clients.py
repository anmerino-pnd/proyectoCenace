from google import genai as google_api
import anthropic as anthropic_api
import openai as openai_api
import mistralai as mistral_api
import ollama as ollama_api



from dotenv import load_dotenv
import os

load_dotenv()

google_api_key = os.getenv("GOOGLE_API_KEY")
anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
openai_api_key = os.getenv("OPENAI_API_KEY")
mistral_api_key = os.getenv("MISTRAL_API_KEY")
ollama_base_url = os.getenv("OLLAMA_BASE_URL")

google = google_api.Client(api_key=google_api_key)
anthropic = anthropic_api.Anthropic(api_key=anthropic_api_key)
openai = openai_api.OpenAI(api_key=openai_api_key)
mistral = mistral_api.Mistral(api_key=mistral_api_key)
ollama = ollama_api.Client(host=ollama_base_url)
