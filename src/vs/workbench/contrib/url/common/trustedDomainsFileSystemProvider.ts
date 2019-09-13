/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ITextModelContentProvider, ITextModelService } from 'vs/editor/common/services/resolverService';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IProductService } from 'vs/platform/product/common/product';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import {
	IFileSystemProvider,
	FileSystemProviderCapabilities,
	IWatchOptions,
	IStat,
	FileType,
	FileDeleteOptions,
	FileOverwriteOptions,
	FileWriteOptions,
	FileOpenOptions,
	IFileService,
	IFileStat
} from 'vs/platform/files/common/files';
import { parse } from 'vs/base/common/json';
// import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';

const TRUSTED_DOMAINS_SCHEMA = 'trustedDomains';

const stat: IStat = {
	type: FileType.File,
	ctime: Date.now(),
	mtime: Date.now(),
	size: 0
};

export class TrustedDomainsContentProvider implements IFileSystemProvider, IWorkbenchContribution {
	readonly capabilities = FileSystemProviderCapabilities.FileReadWrite;
	// FileSystemProviderCapabilities.FileReadWrite +
	// FileSystemProviderCapabilities.PathCaseSensitive;

	readonly onDidChangeCapabilities = Event.None;
	readonly onDidChangeFile = Event.None;

	constructor(
		@ITextModelService private readonly textModelResolverService: ITextModelService,
		@IFileService private readonly fileService: IFileService,
		// @ITextFileService private readonly textFileService: ITextFileService,
		@IProductService private readonly productService: IProductService,
		@IStorageService private readonly storageService: IStorageService,
		@IModeService private readonly modeService: IModeService,
		@IModelService private readonly modelService: IModelService
	) {
		// this.textModelResolverService.registerTextModelContentProvider(TRUSTED_DOMAINS_SCHEMA, this);
		this.fileService.registerProvider(TRUSTED_DOMAINS_SCHEMA, this);
	}

	watch(resource: URI, opts: IWatchOptions): IDisposable {
		return {
			dispose() {
				return;
			}
		};
	}
	stat(resource: URI): Promise<IStat> {
		return Promise.resolve(stat);
	}
	mkdir(resource: URI): Promise<void> {
		return Promise.resolve(undefined!);
	}
	readdir(resource: URI): Promise<[string, FileType][]> {
		return Promise.resolve(undefined!);
	}
	delete(resource: URI, opts: FileDeleteOptions): Promise<void> {
		return Promise.resolve(undefined!);
	}
	rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {
		return Promise.resolve(undefined!);
	}

	readFile?(resource: URI): Promise<Uint8Array> {
		let trustedDomains: string[] = this.productService.linkProtectionTrustedDomains
			? [...this.productService.linkProtectionTrustedDomains]
			: [];

		try {
			const trustedDomainsSrc = this.storageService.get('http.linkProtectionTrustedDomains', StorageScope.GLOBAL);
			if (trustedDomainsSrc) {
				trustedDomains = JSON.parse(trustedDomainsSrc);
			}
		} catch (err) { }

		const trustedDomainsContent = JSON.stringify(trustedDomains, null, 2);

		const buf = Buffer.from(trustedDomainsContent, 'utf-8');
		return Promise.resolve(buf);
	}

	writeFile(resource: URI, content: Uint8Array, opts: FileWriteOptions): Promise<void> {
		let trustedDomainsd = [];

		try {
			trustedDomainsd = parse(content.toString());
		} catch (err) { }

		this.storageService.store(
			'http.linkProtectionTrustedDomains',
			JSON.stringify(trustedDomainsd),
			StorageScope.GLOBAL
		);

		return Promise.resolve();
	}

	public provideTextContent(resource: URI): Promise<ITextModel> {
		let trustedDomains: string[] = this.productService.linkProtectionTrustedDomains
			? [...this.productService.linkProtectionTrustedDomains]
			: [];

		try {
			const trustedDomainsSrc = this.storageService.get('http.linkProtectionTrustedDomains', StorageScope.GLOBAL);
			if (trustedDomainsSrc) {
				trustedDomains = JSON.parse(trustedDomainsSrc);
			}
		} catch (err) { }

		const trustedDomainsContent = JSON.stringify(trustedDomains, null, 2);

		let model = this.modelService.getModel(resource);
		if (!model) {
			model = this.modelService.createModel(
				trustedDomainsContent,
				this.modeService.createByLanguageName('jsonc'),
				URI.parse(TRUSTED_DOMAINS_SCHEMA + ':config')
			);
		} else {
			this.modelService.updateModel(model, trustedDomainsContent);
		}

		return Promise.resolve(model);
	}
}
