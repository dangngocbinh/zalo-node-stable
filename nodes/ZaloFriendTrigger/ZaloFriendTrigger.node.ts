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

		const cookieFromCred = JSON.parse(credentials.cookie as string);
		const imeiFromCred = credentials.imei as string;
		const userAgentFromCred = credentials.userAgent as string;

		let api: API | undefined;
		let stopped = false;
		let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

		const startListening = async (): Promise<void> => {
			if (stopped) return;

			try {
				if (api) {
					api.listener.stop();
					api = undefined;
				}

				const zalo = new Zalo({ imageMetadataGetter });
				api = await zalo.login({ cookie: cookieFromCred, imei: imeiFromCred, userAgent: userAgentFromCred });

				if (!api) {
					throw new NodeOperationError(this.getNode(), 'No API instance returned');
				}

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				api.listener.on('friend_event', async (event: any) => {
					const friendEvent = event as FriendEvent;
					const nodeEventTypes = this.getNodeParameter('eventTypes') as FriendEventType[];

					if (nodeEventTypes.includes(friendEvent.type)) {
						this.emit([this.helpers.returnJsonArray({ friendEvent: friendEvent.data })]);
					}
				});

				api.listener.on('closed', (code, reason) => {
					this.logger.warn(`[ZaloFriendTrigger] Listener closed (code=${code}, reason=${reason}). Re-logging in...`);
					if (!stopped) {
						reconnectTimeout = setTimeout(() => startListening(), 5000);
					}
				});

				api.listener.on('error', (error) => {
					this.logger.error(`[ZaloFriendTrigger] Listener error: ${error}`);
				});

				api.listener.start({ retryOnClose: true });
			} catch (error) {
				this.logger.error(`[ZaloFriendTrigger] Login failed: ${(error as Error).message}. Retrying in 10s...`);
				if (!stopped) {
					reconnectTimeout = setTimeout(() => startListening(), 10000);
				}
			}
		};

		await startListening();

		return {
			closeFunction: async () => {
				stopped = true;
				if (reconnectTimeout) {
					clearTimeout(reconnectTimeout);
				}
				if (api) {
					api.listener.stop();
					api = undefined;
				}
			},
		};
	}
}
