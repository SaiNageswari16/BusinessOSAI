import os

target = os.path.join("backend", "src", "api", "deps.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

helper = """
def require_any_permission(*permissions: str):
    async def _dependency(
        ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    ) -> CurrentUserContext:
        if not any(ctx.has_permission(p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing any of required permissions: {', '.join(permissions)}",
            )
        return ctx
    return _dependency
"""

line_ending = "\r\n" if "\r\n" in content else "\n"
helper_file = helper.replace("\n", line_ending)

with open(target, "a", encoding="utf-8", newline="") as f:
    f.write(helper_file)

print("Appended require_any_permission successfully")
