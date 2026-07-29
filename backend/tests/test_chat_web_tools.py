import socket

import httpx

from app.services import chat_web_tools


class DummyResponse:
    def __init__(self, *, text="", json_payload=None, headers=None):
        self.text = text
        self._json_payload = json_payload if json_payload is not None else {}
        self.headers = headers or {}

    def raise_for_status(self):
        return None

    def json(self):
        return self._json_payload


def test_search_web_parses_duckduckgo_html_and_caps_results(monkeypatch):
    html = """
    <html><body>
      <div class="result"><a class="result__a" href="https://example.com/1">One</a><a class="result__snippet">First result</a></div>
      <div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F2">Two</a><a class="result__snippet">Second result</a></div>
      <div class="result"><a class="result__a" href="https://example.com/3">Three</a></div>
      <div class="result"><a class="result__a" href="https://example.com/4">Four</a></div>
      <div class="result"><a class="result__a" href="https://example.com/5">Five</a></div>
      <div class="result"><a class="result__a" href="https://example.com/6">Six</a></div>
    </body></html>
    """
    calls = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.kwargs = kwargs

        def get(self, url, **kwargs):
            calls.append((url, kwargs))
            return DummyResponse(text=html)

        def close(self):
            return None

    monkeypatch.setattr(chat_web_tools.httpx, "Client", FakeClient)

    results = chat_web_tools.search_web("toyota sri lanka")

    assert len(results) == 5
    assert results[0] == {"title": "One", "url": "https://example.com/1", "snippet": "First result"}
    assert results[1]["url"] == "https://example.com/2"
    assert calls[0][0] == chat_web_tools.DUCKDUCKGO_HTML_URL
    assert calls[0][1]["timeout"] == 5.0


def test_search_web_returns_empty_list_when_duckduckgo_fails(monkeypatch):
    class FakeClient:
        def get(self, *args, **kwargs):
            raise httpx.TimeoutException("timeout")

        def close(self):
            return None

    monkeypatch.setattr(chat_web_tools.httpx, "Client", lambda *args, **kwargs: FakeClient())

    assert chat_web_tools.search_web("toyota") == []


def test_fetch_url_text_allows_only_public_allowlisted_domains(monkeypatch):
    monkeypatch.setattr(
        chat_web_tools.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))],
    )

    class FakeClient:
        def get(self, url, **kwargs):
            return DummyResponse(
                text="<html><body><script>ignore()</script><main>Official vehicle safety text.</main></body></html>",
                headers={"content-type": "text/html"},
            )

    text = chat_web_tools.fetch_url_text("https://www.nhtsa.gov/example", client=FakeClient())

    assert text == "Official vehicle safety text."
    assert chat_web_tools.fetch_url_text("https://example.com/not-allowed", client=FakeClient()) == ""
