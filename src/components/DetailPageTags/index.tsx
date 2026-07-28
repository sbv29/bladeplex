import Tag from '@app/components/Common/Tag';
import defineMessages from '@app/utils/defineMessages';
import {
  DETAIL_PAGE_TAGS_EXPANDED_KEY,
  parseTagsExpandedPreference,
  readTagsExpandedPreference,
  writeTagsExpandedPreference,
} from '@app/utils/detailPageTagsPreference';
import { Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { Keyword } from '@server/models/common';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.DetailPageTags', {
  tags: 'Tags',
  showtags: 'Show tags',
  hidetags: 'Hide tags',
});

interface DetailPageTagsProps {
  keywords: Keyword[];
  mediaType: 'movie' | 'tv';
  mobileLimit?: number;
}

const DetailPageTags = ({
  keywords,
  mediaType,
  mobileLimit,
}: DetailPageTagsProps) => {
  const intl = useIntl();
  const panelId = useId();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    try {
      setIsExpanded(readTagsExpandedPreference(window.localStorage));
    } catch {
      setIsExpanded(false);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DETAIL_PAGE_TAGS_EXPANDED_KEY) {
        setIsExpanded(parseTagsExpandedPreference(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (keywords.length === 0) return null;

  const toggleExpanded = () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    try {
      writeTagsExpandedPreference(window.localStorage, nextExpanded);
    } catch {
      // Keep the in-memory preference when browser storage is unavailable.
    }
  };

  return (
    <section className="mt-6">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md py-2 text-left text-lg font-semibold text-gray-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={toggleExpanded}
      >
        <span>{intl.formatMessage(messages.tags)}</span>
        <span className="ml-3 flex items-center gap-1 text-sm font-medium text-gray-400">
          {intl.formatMessage(
            isExpanded ? messages.hidetags : messages.showtags
          )}
          <ChevronDownIcon
            className={`h-5 w-5 transition-transform duration-150 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </span>
      </button>
      <Transition
        show={isExpanded}
        enter="transition-opacity duration-100 ease-out"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-75 ease-out"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div id={panelId} className="pt-2">
          {keywords.map((keyword, index) => (
            <Link
              href={`/discover/${mediaType === 'movie' ? 'movies' : 'tv'}?keywords=${keyword.id}`}
              key={`keyword-id-${keyword.id}`}
              className={`mb-2 mr-2 last:mr-0 ${
                mobileLimit !== undefined && index >= mobileLimit
                  ? 'hidden xl:inline-flex'
                  : 'inline-flex'
              }`}
            >
              <Tag>{keyword.name}</Tag>
            </Link>
          ))}
        </div>
      </Transition>
    </section>
  );
};

export default DetailPageTags;
