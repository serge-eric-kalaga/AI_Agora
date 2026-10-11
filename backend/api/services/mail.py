from datetime import datetime, timezone
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from api.configs.config import Setting
from jinja2 import Environment, FileSystemLoader, Template
from api.configs import logging as logSVC


base_dir = os.path.dirname(os.path.abspath(__file__))
html_folder_path = os.path.join(base_dir, "../html/email")
env = Environment(loader=FileSystemLoader(html_folder_path))


def send_email(receiver_email, message_text, object):
    # Créer un objet MIMEMultipart pour représenter le message
    logSVC.logInfo(f"Sending email to {receiver_email}")
    from_email = f"notification@{Setting.EMAIL_DOMAIN}"
    message = MIMEMultipart()
    message["From"] = from_email
    message["To"] = receiver_email
    message["Subject"] = object

    # Créer une partie de message MIMEText pour le corps du message
    message_body = MIMEText(str(message_text).encode("utf-8"), "html", "utf-8")
    message.attach(message_body)

    try:
        # Créer une session SMTP et envoyer le message
        with smtplib.SMTP(Setting.EMAIL_HOST, Setting.EMAIL_PORT) as server:
            server.starttls()
            server.login(user=Setting.EMAIL_USERNAME, password=Setting.EMAIL_PASSWORD)
            server.sendmail(from_email, receiver_email, message.as_string())
            logSVC.logInfo(f"Email sent to {receiver_email}")
            return True
    except Exception as e:
        print("Error: unable to send email")
        print(e)
        return False


def send_app_exception_to_admin(
    email_list: list[str] = (Setting.ADMINS_EMAIL).split(","),
    error_message: str = None,
    error_type: str = "Exception | Error | Bug",
) -> bool:
    """
    Envoi un email aux administrateurs de l'application en cas d'erreur
    """

    try:
        params = {
            "error_type": error_type,
            "error_message": error_message,
            "timestamp": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S"),
            "app_name": Setting.APP_NAME,
        }
        template: Template = env.get_template("error500_admin_mail.html")
        for email in email_list:
            message = template.render(**params)
            send_email(
                receiver_email=email,
                message_text=message,
                object=f"{Setting.APP_NAME} - Error 500",
            )
        return True
    except Exception as e:
        print(e)
        logSVC.logError(e)
        return False
