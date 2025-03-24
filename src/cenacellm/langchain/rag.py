from string import Template
from cenacellm.langchain.retriever import VectorStore
from cenacellm.types import LLMAPIResponseError
from cenacellm.langchain.history import ChatHistoryManager

from langchain.schema import AIMessage, HumanMessage
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain, create_history_aware_retriever

class RAGassistant(VectorStore):
    def __init__(self, llm, VECTOR_DB_PATH, embedding_model):
        super().__init__(VECTOR_DB_PATH, embedding_model)
        self.llm = llm
        self.history = ChatHistoryManager()
        self.histories = self.history.histories
        self.retriever = self.asRetriever()
        

    def report_system(self) -> str:
        return ("""
        Eres un asistente técnico de TI y ayudas a los usuarios a resolver problemas técnicos.
        """
        )

    def report_history_prompt(self) -> str:
        return (
            "Dada una historia de chat y la última pregunta del usuario "
            "que podría hacer referencia al contexto en la historia de chat, "
            "formula una pregunta independiente que pueda ser entendida "
            "sin la historia de chat. NO respondas la pregunta, "
            "solo reformúlala si es necesario y, en caso contrario, devuélvela tal como está." 
        )

    def QpromptTemplate(self):
        return ChatPromptTemplate.from_messages(
            [
                ("system", self.report_history_prompt()),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

    def report_user(self) -> str:
        tpl = (
            "Usa los siguientes fragmentos de contexto para brindar una solución. "
            "Si no son suficientes, pide más información al usuario, "
            "basandote en las 5 preguntas W (qué, quién, cuándo, dónde, por qué)."
            "\n\n"
            "{context}"  
        )
        return tpl


    def QApromptTemplate(self):
        return ChatPromptTemplate.from_messages(
            [
                ("system", self.report_user()),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
    
    def get_session_history(self, session_id: str) -> BaseChatMessageHistory:
        """Obtiene el historial de una sesión específica y lo convierte en BaseChatMessageHistory."""
        if session_id not in self.histories:
            self.histories[session_id] = []

        messages = [
            HumanMessage(content=m["content"]) if m["type"] == "human" else AIMessage(content=m["content"])
            for m in self.histories[session_id]
        ]
        return ChatMessageHistory(messages=messages)
       
    def build_chain(self):
        history_aware_retriever = create_history_aware_retriever(self.llm, self.retriever, self.QpromptTemplate())
        question_answer_chain = create_stuff_documents_chain(self.llm, self.QApromptTemplate())
        return create_retrieval_chain(history_aware_retriever, question_answer_chain)

    def build_conversational_chain(self) -> RunnableWithMessageHistory:
        rag_chain = self.build_chain()
        return RunnableWithMessageHistory(
            rag_chain,
            self.get_session_history,
            input_messages_key="input",
            history_messages_key="chat_history",
            output_messages_key="answer",
        )

    def prompt(self, user_inquiry: str, user_id: str) -> str:
        try:
            return self.build_conversational_chain().invoke(
                {"input": user_inquiry}, 
                config={"configurable": {"session_id": user_id}}
            )
        except Exception as e:
            raise LLMAPIResponseError(response=None, message="Error al invocar el modelo LLM.", exception=e)