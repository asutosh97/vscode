/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchConstructionOptions, create } from 'vs/workbench/workbench.web.api';
import { IURLCallbackProvider } from 'vs/workbench/services/url/browser/urlService';
import { Event, Emitter } from 'vs/base/common/event';
import { URI, UriComponents } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { CancellationToken } from 'vs/base/common/cancellation';
import { streamToBuffer } from 'vs/base/common/buffer';
import { Disposable } from 'vs/base/common/lifecycle';
import { request } from 'vs/base/parts/request/browser/request';
import { ICredentialsProvider } from 'vs/workbench/services/credentials/browser/credentialsService';

interface ICredential {
	service: string;
	account: string;
	password: string;
}

class LocalStorageCredentialsProvider implements ICredentialsProvider {

	static readonly CREDENTIALS_OPENED_KEY = 'credentials.provider';

	private _credentials: ICredential[];
	private get credentials(): ICredential[] {
		if (!this._credentials) {
			try {
				const serializedCredentials = window.localStorage.getItem(LocalStorageCredentialsProvider.CREDENTIALS_OPENED_KEY);
				if (serializedCredentials) {
					this._credentials = JSON.parse(serializedCredentials);
				}
			} catch (error) {
				// ignore
			}

			if (!Array.isArray(this._credentials)) {
				this._credentials = [];
			}
		}

		return this._credentials;
	}

	private save(): void {
		window.localStorage.setItem(LocalStorageCredentialsProvider.CREDENTIALS_OPENED_KEY, JSON.stringify(this.credentials));
	}

	async getPassword(service: string, account: string): Promise<string | null> {
		return this.doGetPassword(service, account);
	}

	private async doGetPassword(service: string, account?: string): Promise<string | null> {
		for (const credential of this.credentials) {
			if (credential.service === service) {
				if (typeof account !== 'string' || account === credential.account) {
					return credential.password;
				}
			}
		}

		return null;
	}

	async setPassword(service: string, account: string, password: string): Promise<void> {
		this.deletePassword(service, account);

		this.credentials.push({ service, account, password });

		this.save();
	}

	async deletePassword(service: string, account: string): Promise<boolean> {
		let found = false;

		this._credentials = this.credentials.filter(credential => {
			if (credential.service === service && credential.account === account) {
				found = true;

				return false;
			}

			return true;
		});

		if (found) {
			this.save();
		}

		return found;
	}

	async findPassword(service: string): Promise<string | null> {
		return this.doGetPassword(service);
	}

	async findCredentials(service: string): Promise<Array<{ account: string, password: string }>> {
		return this.credentials
			.filter(credential => credential.service === service)
			.map(({ account, password }) => ({ account, password }));
	}
}

class PollingURLCallbackProvider extends Disposable implements IURLCallbackProvider {

	static FETCH_INTERVAL = 500; 			// fetch every 500ms
	static FETCH_TIMEOUT = 5 * 60 * 1000; 	// ...but stop after 5min

	static QUERY_KEYS = {
		REQUEST_ID: 'vscode-requestId',
		SCHEME: 'vscode-scheme',
		AUTHORITY: 'vscode-authority',
		PATH: 'vscode-path',
		QUERY: 'vscode-query',
		FRAGMENT: 'vscode-fragment'
	};

	private readonly _onCallback: Emitter<UriComponents> = this._register(new Emitter<UriComponents>());
	readonly onCallback: Event<UriComponents> = this._onCallback.event;

	create(options?: Partial<UriComponents>): URI {
		const queryValues: Map<string, string> = new Map();

		const requestId = generateUuid();
		queryValues.set(PollingURLCallbackProvider.QUERY_KEYS.REQUEST_ID, requestId);

		const { scheme, authority, path, query, fragment } = options ? options : { scheme: undefined, authority: undefined, path: undefined, query: undefined, fragment: undefined };

		if (scheme) {
			queryValues.set(PollingURLCallbackProvider.QUERY_KEYS.SCHEME, scheme);
		}

		if (authority) {
			queryValues.set(PollingURLCallbackProvider.QUERY_KEYS.AUTHORITY, authority);
		}

		if (path) {
			queryValues.set(PollingURLCallbackProvider.QUERY_KEYS.PATH, path);
		}

		if (query) {
			queryValues.set(PollingURLCallbackProvider.QUERY_KEYS.QUERY, query);
		}

		if (fragment) {
			queryValues.set(PollingURLCallbackProvider.QUERY_KEYS.FRAGMENT, fragment);
		}

		// Start to poll on the callback being fired
		this.periodicFetchCallback(requestId, Date.now());

		return this.doCreateUri('/callback', queryValues);
	}

	private async periodicFetchCallback(requestId: string, startTime: number): Promise<void> {

		// Ask server for callback results
		const queryValues: Map<string, string> = new Map();
		queryValues.set(PollingURLCallbackProvider.QUERY_KEYS.REQUEST_ID, requestId);

		const result = await request({
			url: this.doCreateUri('/fetch-callback', queryValues).toString(true)
		}, CancellationToken.None);

		// Check for callback results
		const content = await streamToBuffer(result.stream);
		if (content.byteLength > 0) {
			try {
				this._onCallback.fire(JSON.parse(content.toString()));
			} catch (error) {
				console.error(error);
			}

			return; // done
		}

		// Continue fetching unless we hit the timeout
		if (Date.now() - startTime < PollingURLCallbackProvider.FETCH_TIMEOUT) {
			setTimeout(() => this.periodicFetchCallback(requestId, startTime), PollingURLCallbackProvider.FETCH_INTERVAL);
		}
	}

	private doCreateUri(path: string, queryValues: Map<string, string>): URI {
		let query: string | undefined = undefined;

		if (queryValues) {
			let index = 0;
			queryValues.forEach((value, key) => {
				if (!query) {
					query = '';
				}

				const prefix = (index++ === 0) ? '' : '&';
				query += `${prefix}${key}=${encodeURIComponent(value)}`;
			});
		}

		return URI.parse(window.location.href).with({ path, query });
	}
}

const options: IWorkbenchConstructionOptions = JSON.parse(document.getElementById('vscode-workbench-web-configuration')!.getAttribute('data-settings')!);
options.urlCallbackProvider = new PollingURLCallbackProvider();
options.credentialsProvider = new LocalStorageCredentialsProvider();

create(document.body, options);
