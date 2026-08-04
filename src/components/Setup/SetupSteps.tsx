import { CheckIcon } from '@heroicons/react/24/solid';

interface CurrentStep {
  stepNumber: number;
  description: string;
  active?: boolean;
  completed?: boolean;
  isLastStep?: boolean;
}

const SetupSteps = ({
  stepNumber,
  description,
  active = false,
  completed = false,
  isLastStep = false,
}: CurrentStep) => {
  return (
    <li className="relative min-w-0 md:flex">
      <div className="flex w-full min-w-0 items-center gap-2 px-3 py-4 font-medium">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center border-2 ${
            active ? 'border-indigo-600' : 'border-white'
          } ${completed ? 'border-indigo-600 bg-indigo-600' : ''} rounded-full`}
        >
          {completed && <CheckIcon className="h-5 w-5 text-white" />}
          {!completed && (
            <p className={active ? 'text-white' : 'text-indigo-200'}>
              {stepNumber}
            </p>
          )}
        </div>
        <p
          className={`min-w-0 whitespace-normal break-words text-xs font-medium leading-4 lg:text-sm lg:leading-5 ${
            active ? 'text-white' : 'text-indigo-200'
          }`}
        >
          {description}
        </p>
      </div>

      {!isLastStep && (
        <div className="absolute right-0 top-0 hidden h-full w-3 md:block">
          <svg
            className="h-full w-full text-gray-600"
            viewBox="0 0 22 80"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d="M0 -2L20 40L0 82"
              vectorEffect="non-scaling-stroke"
              stroke="currentcolor"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </li>
  );
};

export default SetupSteps;
