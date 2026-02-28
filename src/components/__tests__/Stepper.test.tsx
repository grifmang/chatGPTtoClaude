import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "../Stepper";

const STEPS = ["Get your data", "Download export", "Upload & extract"];

describe("Stepper", () => {
  it("renders all step labels", () => {
    render(<Stepper steps={STEPS} currentStep={0} onStepClick={vi.fn()} />);
    expect(screen.getByText("Get your data")).toBeInTheDocument();
    expect(screen.getByText("Download export")).toBeInTheDocument();
    expect(screen.getByText("Upload & extract")).toBeInTheDocument();
  });

  it("marks current step as active", () => {
    render(<Stepper steps={STEPS} currentStep={1} onStepClick={vi.fn()} />);
    const step2 = screen.getByText("Download export").closest(".stepper-step");
    expect(step2).toHaveClass("stepper-step--active");
  });

  it("marks completed steps", () => {
    render(<Stepper steps={STEPS} currentStep={2} onStepClick={vi.fn()} />);
    const step1 = screen.getByText("Get your data").closest(".stepper-step");
    expect(step1).toHaveClass("stepper-step--completed");
  });

  it("calls onStepClick when a completed step is clicked", async () => {
    const onClick = vi.fn();
    render(<Stepper steps={STEPS} currentStep={2} onStepClick={onClick} />);
    await userEvent.click(screen.getByText("Get your data"));
    expect(onClick).toHaveBeenCalledWith(0);
  });

  it("does not call onStepClick for future steps", async () => {
    const onClick = vi.fn();
    render(<Stepper steps={STEPS} currentStep={0} onStepClick={onClick} />);
    await userEvent.click(screen.getByText("Upload & extract"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
