import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

def send_email(to_email: str, subject: str, content: str):
    """
    Sends an email using SMTP settings from the environment.
    """
    load_dotenv()
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_user or not smtp_password:
        print(f"Warning: SMTP credentials not found. Email to {to_email} not sent.")
        print(f"Content: {content}")
        return False

    try:
        msg = EmailMessage()
        msg.set_content(content)
        msg['Subject'] = f"HumatiQ - {subject}"
        msg['From'] = smtp_user
        msg['To'] = to_email

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(smtp_user, smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
