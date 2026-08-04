import { accessSync, existsSync, readFileSync } from 'fs';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_DIRECTORY
  ? process.env.CONFIG_DIRECTORY
  : path.join(__dirname, '../../config');

const DOCKER_PATH = `${CONFIG_PATH}/DOCKER`;
const MOUNT_INFO_PATH = '/proc/self/mountinfo';

const decodeMountPath = (value: string): string =>
  value.replace(/\\([0-7]{3})/g, (_match, octal: string) =>
    String.fromCharCode(Number.parseInt(octal, 8))
  );

export const isPathMounted = (
  targetPath: string,
  mountInfo: string
): boolean => {
  const resolvedTarget = path.resolve(targetPath);

  return mountInfo.split('\n').some((line) => {
    const fields = line.split(' ');
    return (
      fields.length > 4 &&
      path.resolve(decodeMountPath(fields[4])) === resolvedTarget
    );
  });
};

export const appDataStatus = (): boolean => {
  try {
    if (isPathMounted(CONFIG_PATH, readFileSync(MOUNT_INFO_PATH, 'utf8'))) {
      return true;
    }
  } catch {
    // /proc/self/mountinfo is Linux-specific. Retain the marker fallback on
    // platforms where it is unavailable.
  }

  return !existsSync(DOCKER_PATH);
};

export const appDataPath = (): string => {
  return CONFIG_PATH;
};

export const appDataPermissions = (): boolean => {
  try {
    accessSync(CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
};
