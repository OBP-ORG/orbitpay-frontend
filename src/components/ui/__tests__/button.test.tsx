import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "../button";

describe("Button", () => {
  it("renders its label and calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Approve</Button>);

    const button = screen.getByRole("button", { name: "Approve" });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button onClick={onClick} disabled>
        Approve
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
