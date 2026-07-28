export const DETAIL_PAGE_TAGS_EXPANDED_KEY = 'detailPageTagsExpanded';

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const parseTagsExpandedPreference = (value: string | null): boolean =>
  value === 'true';

export const readTagsExpandedPreference = (
  storage: PreferenceStorage
): boolean => {
  try {
    return parseTagsExpandedPreference(
      storage.getItem(DETAIL_PAGE_TAGS_EXPANDED_KEY)
    );
  } catch {
    return false;
  }
};

export const writeTagsExpandedPreference = (
  storage: PreferenceStorage,
  isExpanded: boolean
): void => {
  try {
    storage.setItem(DETAIL_PAGE_TAGS_EXPANDED_KEY, String(isExpanded));
  } catch {
    // The current page state still works when browser storage is unavailable.
  }
};
