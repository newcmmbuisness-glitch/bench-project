import json
import os
from chatterbot import ChatBot
from chatterbot.logic import BestMatch

# Der Haupt-Handler, der auf Anfragen von deinem JavaScript-Backend reagiert.
def handler(event, context):
    try:
        body = json.loads(event.body)
        user_message = body.get("userMessage", "")

        if not user_message:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No userMessage provided", "success": False})
            }

        # Lade den Chatbot, der auf die trainierten Daten in der Datenbank zugreift.
        chatbot = ChatBot(
            'MeinChatbot',
            storage_adapter='chatterbot.storage.SQLStorageAdapter',
            database_uri=os.environ.get("DATABASE_URL"),
            logic_adapters=[
                {
                    "import_path": "chatterbot.logic.BestMatch",
                    "maximum_similarity_threshold": 0.5 # Nur Antworten mit hoher Ähnlichkeit akzeptieren
                }
            ]
        )

        # Hole die beste Antwort basierend auf der Nutzernachricht.
        response = chatbot.get_response(user_message)

        # Überprüfe, ob die Antwort eine hohe Konfidenz hat.
        if response.confidence > 0.5:
            return {
                "statusCode": 200,
                "body": json.dumps({"response": str(response), "success": True})
            }
        else:
            # Wenn die Konfidenz zu gering ist, gib ein Signal für den Fallback.
            return {
                "statusCode": 200,
                "body": json.dumps({"response": "fallback", "success": False})
            }
    except Exception as e:
        # Bei einem Fehler (z.B. Datenbankproblem) ebenfalls den Fallback signalisieren.
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "success": False})
        }
