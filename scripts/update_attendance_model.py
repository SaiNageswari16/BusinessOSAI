import os

model_file = os.path.join("backend", "src", "models", "__init__.py")
with open(model_file, "r", encoding="utf-8") as f:
    content = f.read()

target_model_lines = """    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    notes: Mapped[str | None] = mapped_column(Text)"""

replacement_model_lines = """    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    notes: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(50))"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(target_model_lines.replace("\n", line_ending), replacement_model_lines.replace("\n", line_ending))

with open(model_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated models/__init__.py successfully")
