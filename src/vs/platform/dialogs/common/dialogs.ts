/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { basename } from 'vs/base/common/resources';
import { localize } from 'vs/nls';
import { FileFilter } from 'vs/platform/windows/common/windows';
import { ITelemetryData } from 'vs/platform/telemetry/common/telemetry';

export type DialogType = 'none' | 'info' | 'error' | 'question' | 'warning';

export interface IConfirmation {
	title?: string;
	type?: DialogType;
	message: string;
	detail?: string;
	primaryButton?: string;
	secondaryButton?: string;
	checkbox?: {
		label: string;
		checked?: boolean;
	};
}

export interface IConfirmationResult {

	/**
	 * Will be true if the dialog was confirmed with the primary button
	 * pressed.
	 */
	confirmed: boolean;

	/**
	 * This will only be defined if the confirmation was created
	 * with the checkbox option defined.
	 */
	checkboxChecked?: boolean;
}

export interface IShowResult {

	/**
	 * Selected choice index. If the user refused to choose,
	 * then a promise with index of `cancelId` option is returned. If there is no such
	 * option then promise with index `0` is returned.
	 */
	choice: number;

	/**
	 * This will only be defined if the confirmation was created
	 * with the checkbox option defined.
	 */
	checkboxChecked?: boolean;
}

export interface IPickAndOpenOptions {
	forceNewWindow?: boolean;
	defaultUri?: URI;
	telemetryExtraData?: ITelemetryData;
	availableFileSystems?: string[];
}

export interface ISaveDialogOptions {
	/**
	 * A human-readable string for the dialog title
	 */
	title?: string;

	/**
	 * The resource the dialog shows when opened.
	 */
	defaultUri?: URI;

	/**
	 * A set of file filters that are used by the dialog. Each entry is a human readable label,
	 * like "TypeScript", and an array of extensions.
	 */
	filters?: FileFilter[];

	/**
	 * A human-readable string for the ok button
	 */
	saveLabel?: string;

	/**
	 * Specifies a list of schemas for the file systems the user can save to. If not specified, uses the schema of the defaultURI or, if also not specified,
	 * the schema of the current window.
	 */
	availableFileSystems?: string[];
}

export interface IOpenDialogOptions {
	/**
	 * A human-readable string for the dialog title
	 */
	title?: string;

	/**
	 * The resource the dialog shows when opened.
	 */
	defaultUri?: URI;

	/**
	 * A human-readable string for the open button.
	 */
	openLabel?: string;

	/**
	 * Allow to select files, defaults to `true`.
	 */
	canSelectFiles?: boolean;

	/**
	 * Allow to select folders, defaults to `false`.
	 */
	canSelectFolders?: boolean;

	/**
	 * Allow to select many files or folders.
	 */
	canSelectMany?: boolean;

	/**
	 * A set of file filters that are used by the dialog. Each entry is a human readable label,
	 * like "TypeScript", and an array of extensions.
	 */
	filters?: FileFilter[];

	/**
	 * Specifies a list of schemas for the file systems the user can load from. If not specified, uses the schema of the defaultURI or, if also not available,
	 * the schema of the current window.
	 */
	availableFileSystems?: string[];
}


export const IDialogService = createDecorator<IDialogService>('dialogService');

export interface IDialogOptions {
	cancelId?: number;
	detail?: string;
	checkbox?: {
		label: string;
		checked?: boolean;
	};
}

/**
 * A service to bring up modal dialogs.
 *
 * Note: use the `INotificationService.prompt()` method for a non-modal way to ask
 * the user for input.
 */
export interface IDialogService {

	_serviceBrand: undefined;

	/**
	 * Ask the user for confirmation with a modal dialog.
	 */
	confirm(confirmation: IConfirmation): Promise<IConfirmationResult>;

	/**
	 * Present a modal dialog to the user.
	 *
	 * @returns A promise with the selected choice index. If the user refused to choose,
	 * then a promise with index of `cancelId` option is returned. If there is no such
	 * option then promise with index `0` is returned.
	 */
	show(severity: Severity, message: string, buttons: string[], options?: IDialogOptions): Promise<IShowResult>;
}

export const IFileDialogService = createDecorator<IFileDialogService>('fileDialogService');

/**
 * A service to bring up file dialogs.
 */
export interface IFileDialogService {

	_serviceBrand: undefined;

	/**
	 * The default path for a new file based on previously used files.
	 * @param schemeFilter The scheme of the file path. If no filter given, the scheme of the current window is used.
	 */
	defaultFilePath(schemeFilter?: string): URI | undefined;

	/**
	 * The default path for a new folder based on previously used folders.
	 * @param schemeFilter The scheme of the folder path. If no filter given, the scheme of the current window is used.
	 */
	defaultFolderPath(schemeFilter?: string): URI | undefined;

	/**
	 * The default path for a new workspace based on previously used workspaces.
	 * @param schemeFilter The scheme of the workspace path. If no filter given, the scheme of the current window is used.
	 */
	defaultWorkspacePath(schemeFilter?: string): URI | undefined;

	/**
	 * Shows a file-folder selection dialog and opens the selected entry.
	 */
	pickFileFolderAndOpen(options: IPickAndOpenOptions): Promise<void>;

	/**
	 * Shows a file selection dialog and opens the selected entry.
	 */
	pickFileAndOpen(options: IPickAndOpenOptions): Promise<void>;

	/**
	 * Shows a folder selection dialog and opens the selected entry.
	 */
	pickFolderAndOpen(options: IPickAndOpenOptions): Promise<void>;

	/**
	 * Shows a workspace selection dialog and opens the selected entry.
	 */
	pickWorkspaceAndOpen(options: IPickAndOpenOptions): Promise<void>;

	/**
	 * Shows a save file file dialog and save the file at the chosen file URI.
	 */
	pickFileToSave(options: ISaveDialogOptions): Promise<URI | undefined>;

	/**
	 * Shows a save file dialog and returns the chosen file URI.
	 */
	showSaveDialog(options: ISaveDialogOptions): Promise<URI | undefined>;

	/**
	 * Shows a open file dialog and returns the chosen file URI.
	 */
	showOpenDialog(options: IOpenDialogOptions): Promise<URI[] | undefined>;

}

const MAX_CONFIRM_FILES = 10;
export function getConfirmMessage(start: string, resourcesToConfirm: readonly URI[]): string {
	const message = [start];
	message.push('');
	message.push(...resourcesToConfirm.slice(0, MAX_CONFIRM_FILES).map(r => basename(r)));

	if (resourcesToConfirm.length > MAX_CONFIRM_FILES) {
		if (resourcesToConfirm.length - MAX_CONFIRM_FILES === 1) {
			message.push(localize('moreFile', "...1 additional file not shown"));
		} else {
			message.push(localize('moreFiles', "...{0} additional files not shown", resourcesToConfirm.length - MAX_CONFIRM_FILES));
		}
	}

	message.push('');
	return message.join('\n');
}
