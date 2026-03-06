import { screen } from "@testing-library/react";
import { render } from "@/test/test-utils";
import { Home } from "@/pages/Home";

describe("Home", () => {
  it("renders landing page with title and description", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /strategic survey engine/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/use the url provided by the system administrator/i)
    ).toBeInTheDocument();
  });
});
