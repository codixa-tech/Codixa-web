from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """Uniform error body: {"error": code, "detail": ...} so the UI can show clear messages."""
    response = exception_handler(exc, context)
    if response is not None:
        data = response.data
        code = getattr(exc, "default_code", "error")
        response.data = {"error": code, "detail": data}
    return response
