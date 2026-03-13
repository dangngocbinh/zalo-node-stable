import {
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	NodeOperationError,
} from 'n8n-workflow';
import { API, Zalo, FriendEventType, FriendEvent } from 'zca-js';
import { imageMetadataGetter } from '../utils/helper';

export class ZaloFriendTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zalo Friend Trigger',
		name: 'zaloFriendTrigger',
		icon: 'file:../shared/zalo.svg',
		group: ['trigger'],
		version: 1,
		description: 'Lắng nghe sự kiện kết bạn trên Zalo',
		defaults: {
			name: 'Zalo Friend Trigger',
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
						name: 'Friend Requests',
						value: FriendEventType.REQUEST,
						description: 'Nghe sự kiện yêu cầu kết bạn',
					}
				],
				default: [FriendEventType.REQUEST],
				required: true,
				description: 'Friend events to listen for',
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

			const zalo = new Zalo({ imageMetadataGetter });
			api = await zalo.login({ cookie: cookieFromCred, imei: imeiFromCred, userAgent: userAgentFromCred });

			if (!api) {
				throw new NodeOperationError(
					this.getNode(),
					'No API instance found. Please make sure to provide valid credentials.',
				);
			}

			// Add friend event listener
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			api.listener.on('friend_event', async (event: any) => {
				const friendEvent = event as FriendEvent;
				const nodeEventTypes = this.getNodeParameter('eventTypes') as FriendEventType[];

				if (nodeEventTypes.includes(friendEvent.type)) {
					this.emit([this.helpers.returnJsonArray({ friendEvent: friendEvent.data })]);
				}
			});

			// Start listening
			api.listener.start({ retryOnClose: true });

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
