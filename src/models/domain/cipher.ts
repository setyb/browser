import { Abstractions, Enums, Data } from '@bitwarden/jslib';

import { Attachment } from './attachment';
import { Card } from './card';
import { CipherString } from './cipherString';
import Domain from './domain';
import { Field } from './field';
import { Identity } from './identity';
import { Login } from './login';
import { SecureNote } from './secureNote';

class Cipher extends Domain {
    id: string;
    organizationId: string;
    folderId: string;
    name: CipherString;
    notes: CipherString;
    type: Enums.CipherType;
    favorite: boolean;
    organizationUseTotp: boolean;
    edit: boolean;
    localData: any;
    login: Login;
    identity: Identity;
    card: Card;
    secureNote: SecureNote;
    attachments: Attachment[];
    fields: Field[];
    collectionIds: string[];

    constructor(obj?: Data.Cipher, alreadyEncrypted: boolean = false, localData: any = null) {
        super();
        if (obj == null) {
            return;
        }

        this.buildDomainModel(this, obj, {
            id: null,
            organizationId: null,
            folderId: null,
            name: null,
            notes: null,
        }, alreadyEncrypted, ['id', 'organizationId', 'folderId']);

        this.type = obj.type;
        this.favorite = obj.favorite;
        this.organizationUseTotp = obj.organizationUseTotp;
        this.edit = obj.edit;
        this.collectionIds = obj.collectionIds;
        this.localData = localData;

        switch (this.type) {
            case Enums.CipherType.Login:
                this.login = new Login(obj.login, alreadyEncrypted);
                break;
            case Enums.CipherType.SecureNote:
                this.secureNote = new SecureNote(obj.secureNote, alreadyEncrypted);
                break;
            case Enums.CipherType.Card:
                this.card = new Card(obj.card, alreadyEncrypted);
                break;
            case Enums.CipherType.Identity:
                this.identity = new Identity(obj.identity, alreadyEncrypted);
                break;
            default:
                break;
        }

        if (obj.attachments != null) {
            this.attachments = [];
            obj.attachments.forEach((attachment) => {
                this.attachments.push(new Attachment(attachment, alreadyEncrypted));
            });
        } else {
            this.attachments = null;
        }

        if (obj.fields != null) {
            this.fields = [];
            obj.fields.forEach((field) => {
                this.fields.push(new Field(field, alreadyEncrypted));
            });
        } else {
            this.fields = null;
        }
    }

    async decrypt(): Promise<any> {
        const model = {
            id: this.id,
            organizationId: this.organizationId,
            folderId: this.folderId,
            favorite: this.favorite,
            type: this.type,
            localData: this.localData,
            login: null as any,
            card: null as any,
            identity: null as any,
            secureNote: null as any,
            subTitle: null as string,
            attachments: null as any[],
            fields: null as any[],
            collectionIds: this.collectionIds,
        };

        await this.decryptObj(model, {
            name: null,
            notes: null,
        }, this.organizationId);

        switch (this.type) {
            case Enums.CipherType.Login:
                model.login = await this.login.decrypt(this.organizationId);
                model.subTitle = model.login.username;
                if (model.login.uri) {
                    const containerService = (window as any).BitwardenContainerService;
                    if (containerService) {
                        const platformUtilsService: Abstractions.PlatformUtilsService =
                            containerService.getPlatformUtilsService();
                        model.login.domain = platformUtilsService.getDomain(model.login.uri);
                    } else {
                        throw new Error('window.BitwardenContainerService not initialized.');
                    }
                }
                break;
            case Enums.CipherType.SecureNote:
                model.secureNote = await this.secureNote.decrypt(this.organizationId);
                model.subTitle = null;
                break;
            case Enums.CipherType.Card:
                model.card = await this.card.decrypt(this.organizationId);
                model.subTitle = model.card.brand;
                if (model.card.number && model.card.number.length >= 4) {
                    if (model.subTitle !== '') {
                        model.subTitle += ', ';
                    }
                    model.subTitle += ('*' + model.card.number.substr(model.card.number.length - 4));
                }
                break;
            case Enums.CipherType.Identity:
                model.identity = await this.identity.decrypt(this.organizationId);
                model.subTitle = '';
                if (model.identity.firstName) {
                    model.subTitle = model.identity.firstName;
                }
                if (model.identity.lastName) {
                    if (model.subTitle !== '') {
                        model.subTitle += ' ';
                    }
                    model.subTitle += model.identity.lastName;
                }
                break;
            default:
                break;
        }

        const orgId = this.organizationId;

        if (this.attachments != null && this.attachments.length > 0) {
            const attachments: any[] = [];
            await this.attachments.reduce((promise, attachment) => {
                return promise.then(() => {
                    return attachment.decrypt(orgId);
                }).then((decAttachment) => {
                    attachments.push(decAttachment);
                });
            }, Promise.resolve());
            model.attachments = attachments;
        }

        if (this.fields != null && this.fields.length > 0) {
            const fields: any[] = [];
            await this.fields.reduce((promise, field) => {
                return promise.then(() => {
                    return field.decrypt(orgId);
                }).then((decField) => {
                    fields.push(decField);
                });
            }, Promise.resolve());
            model.fields = fields;
        }

        return model;
    }
}

export { Cipher };
(window as any).Cipher = Cipher;
