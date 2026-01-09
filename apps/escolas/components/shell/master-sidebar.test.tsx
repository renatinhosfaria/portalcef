import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MasterSidebar } from "./master-sidebar";

describe("MasterSidebar", () => {
  it("shows Portal CEF branding", () => {
    render(<MasterSidebar />);

    expect(screen.getByText("Portal CEF")).toBeInTheDocument();
  });
});
