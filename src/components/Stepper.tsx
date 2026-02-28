import "./Stepper.css";

type StepperProps = {
  steps: string[];
  currentStep: number;
  onStepClick: (step: number) => void;
};

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((label, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;
        const className = [
          "stepper-step",
          isCompleted && "stepper-step--completed",
          isActive && "stepper-step--active",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={i}
            className={className}
            onClick={isCompleted ? () => onStepClick(i) : undefined}
            role={isCompleted ? "button" : undefined}
            tabIndex={isCompleted ? 0 : undefined}
          >
            <span className="stepper-number">
              {isCompleted ? "\u2713" : i + 1}
            </span>
            <span className="stepper-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
