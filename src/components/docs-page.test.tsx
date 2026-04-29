import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocsPage } from "./docs-page";
import { getLessonForCommand } from "../lib/intelligent-search-index";

const scrollIntoViewMock = vi.fn();

afterEach(() => cleanup());

beforeEach(() => {
  scrollIntoViewMock.mockReset();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
});

describe("DocsPage command target", () => {
  it("scrolls to and highlights the targeted command card", async () => {
    const onCommandTargetConsumed = vi.fn();
    const commandId = "containers.listRunning";
    const lesson = getLessonForCommand(commandId);

    expect(lesson).toBeDefined();

    render(
      <DocsPage
        initialCommandId={commandId}
        initialLessonId={lesson?.id}
        onCommandTargetConsumed={onCommandTargetConsumed}
        onOpenPlayground={vi.fn()}
      />
    );

    const card = await screen.findByTestId(`docs-command-${commandId}`);
    expect(card).toHaveAttribute("data-command-id", commandId);
    expect(card.className).toContain("ring-2");

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    });

    await waitFor(
      () => {
        expect(onCommandTargetConsumed).toHaveBeenCalled();
      },
      { timeout: 4000 }
    );

    expect(card.className).not.toContain("ring-2");
  });
});
