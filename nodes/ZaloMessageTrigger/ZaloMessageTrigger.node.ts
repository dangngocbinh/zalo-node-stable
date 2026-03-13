import {
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	NodeOperationError,
} from 'n8n-workflow';
import { API, Zalo, ThreadType } from 'zca-js';
import { imageMetadataGetter } from '../utils/helper';

export class ZaloMessageTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zalo Message Trigger',
		name: 'zaloMessageTrigger',
		icon: 'file:../shared/zalo.svg',
		group: ['trigger'],
		version: 1,
		description: 'Sự kiện lắng nghe tin nhắn trên Zalo',
		defaults: {
			name: 'Zalo Message Trigger',
		},
		// @ts-ignore
		inputs: [],
		// @ts-ignore
		outputs: ['main'],
		credentials: [
			{
				name: 'zaloApi',
				required: true,
				displayName: 'Zalo Credential to connect with',
			},
		],
		properties: [
			{
				displayName: 'Event Types',
				name: 'eventTypes',
				type: 'multiOptions',
				options: [
					{
						name: 'User Messages',
						value: ThreadType.User,
						description: 'Lắng nghe tin nhắn từ người dùng',
					},
					{
						name: 'Group Messages',
						value: ThreadType.Group,
						description: 'Lắng nghe tin nhắn từ nhóm',
					},
				],
				default: [ThreadType.User, ThreadType.Group],
				required: true,
				description: 'Types of messages to listen for',
			},
			{
				displayName: 'Self Listen',
				name: 'selfListen',
				type: 'boolean',
				default: false,
				required: true,
				description: 'Cho phép lắng nghe tin nhắn của chính mình tự gửi',
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const credentials = await this.getCredentials('zaloApi');

		if (!credentials) {
			throw new NodeOperationError(this.getNode(), 'No credentials found');
		}

		let api: API | undefined;

		try {
			const cookieFromCred = JSON.parse(credentials.cookie as string);
			const imeiFromCred = credentials.imei as string;
			const userAgentFromCred = credentials.userAgent as string;

			const selfListen = this.getNodeParameter('selfListen') as boolean;
			const zalo = new Zalo({ selfListen, imageMetadataGetter });
			api = await zalo.login({ cookie: cookieFromCred, imei: imeiFromCred, userAgent: userAgentFromCred });

			if (!api) {
				throw new NodeOperationError(
					this.getNode(),
					'No API instance found. Please make sure to provide valid credentials.',
				);
			}

			// Add message event listener
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			api.listener.on('message', async (message: any) => {
				this.emit([this.helpers.returnJsonArray({ message })]);
			});

			// Start listening
			api.listener.start({ retryOnClose: true });

			// Return close function
			return {
				closeFunction: async () => {
					if (api) {
						api.listener.stop();
						api = undefined;
					}
				},
			};
		} catch (error) {
			if (api) {
				api.listener.stop();
			}
			throw new NodeOperationError(this.getNode(), 'Zalo connection failed. ' + (error as Error).message);
		}
	}
}
