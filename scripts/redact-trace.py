"""Remove session/authentication headers from a shareable Playwright trace."""

import json
import pathlib
import sys
import zipfile

path = pathlib.Path(sys.argv[1])
temporary = path.with_suffix(".redacted.zip")
sensitive = {"cookie", "set-cookie", "authorization", "proxy-authorization"}


def redact(value):
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, dict):
        if str(value.get("name", "")).lower() in sensitive and "value" in value:
            value = {**value, "value": "[redacted]"}
        return {
            key: [] if key.lower() == "cookies" else
            "[redacted]" if key.lower() in sensitive else redact(item)
            for key, item in value.items()
        }
    return value


with zipfile.ZipFile(path) as source, zipfile.ZipFile(
    temporary, "w", compression=zipfile.ZIP_DEFLATED
) as target:
    for info in source.infolist():
        data = source.read(info.filename)
        if info.filename.endswith((".trace", ".network")):
            data = b"\n".join(
                json.dumps(redact(json.loads(line))).encode()
                for line in data.splitlines() if line.strip()
            ) + b"\n"
        target.writestr(info.filename, data)
temporary.replace(path)
