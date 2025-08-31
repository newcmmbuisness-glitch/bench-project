import json
import os
from chatterbot import ChatBot
from chatterbot.trainers import ChatterBotCorpusTrainer

# Handler-Funktion für die Netlify Function
def handler(event, context):
    try:
        # Initialisiere den Chatbot. Die Verbindung zur NeonDB wird hier hergestellt.
        chatbot = ChatBot(
            'MeinChatbot',
            storage_adapter='chatterbot.storage.SQLStorageAdapter',
            database_uri=os.environ.get("DATABASE_URL")
        )

        # Trainer-Instanz
        trainer = ChatterBotCorpusTrainer(chatbot)

        # Lösche alle alten Daten, bevor du neu trainierst.
        # Dadurch wird sichergestellt, dass die Datenbank sauber ist.
        chatbot.storage.drop()

        # Führe das Training mit den deutschen Korpora aus.
        trainer.train("chatterbot.corpus.german")

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Training erfolgreich abgeschlossen!"})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "message": "Training fehlgeschlagen."})
        }
