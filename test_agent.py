from dotenv import load_dotenv
import os
load_dotenv()

from agno.agent import Agent
from agno.models.openai.like import OpenAILike

agent = Agent(
    name="Test Agent",
    model=OpenAILike(
        id="gpt-4o-mini",
        api_key=os.getenv("SUMOPOD_API_KEY"),
        base_url="https://ai.sumopod.com/v1",
    ),
    instructions="Kamu adalah asisten yang membantu content creator merencanakan konten.",
)

agent.print_response("Halo, kamu bisa bantu apa?")