import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { render } from "@/test/test-utils";
import { Layout } from "@/components/Layout";

function LayoutRoute({ path }: { path: string }) {
  return (
    <Routes>
      <Route path={path} element={<Layout />}>
        <Route index element={<div data-testid="outlet-content">Child content</div>} />
      </Route>
    </Routes>
  );
}

function renderLayout(path: string = "/") {
  return render(<LayoutRoute path={path === "/" ? "/" : path} />, {
    routerProps: {
      initialEntries: [path],
      initialIndex: 0,
    },
  });
}

describe("Layout", () => {
  it("renders outlet content", () => {
    renderLayout("/");

    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("shows Strategic Survey Engine in header", () => {
    renderLayout("/");

    expect(screen.getAllByText(/strategic survey engine/i).length).toBeGreaterThan(0);
  });

  it("shows home link when not on contributor page", () => {
    renderLayout("/admin");

    expect(screen.getByRole("link", { name: /strategic survey engine/i })).toBeInTheDocument();
  });

  it("shows admin nav (Surveys, New Survey) on admin page", () => {
    renderLayout("/admin");

    expect(screen.getByRole("link", { name: /surveys/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new survey/i })).toBeInTheDocument();
  });

  it("does not show admin nav on manager page", () => {
    renderLayout("/manager/some-uuid");

    expect(screen.queryByRole("link", { name: /new survey/i })).not.toBeInTheDocument();
  });

  it("shows Admin in footer on admin page", () => {
    renderLayout("/admin");

    expect(screen.getByText(/strategic survey engine · admin/i)).toBeInTheDocument();
  });
});
