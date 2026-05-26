import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { API, ThreadType, Zalo } from 'zca-js';
import { imageMetadataGetter } from '../utils/helper';

let api: API | undefined;

export class ZaloTyping implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zalo Typing',
		name: 'zaloTyping',
		icon: 'file:../shared/zalo.svg',
		// @ts-ignore
		group: ['Zalo'],
		version: 1,
		description: 'Gửi sự kiện đang gõ (typing) đến một thread trong Zalo',
		defaults: {
			name: 'Zalo Typing',
		},
		// @ts-ignore
		inputs: ['main'],
		// @ts-ignore
		outputs: ['main'],
		credentials: [
			{
				name: 'zaloApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Thread ID',
				name: 'threadId',
				type: 'string',
				default: '',
				required: true,
				description: 'ID của thread (người dùng hoặc nhóm) cần gửi typing event',
			},
			{
				displayName: 'Loại Thread',
				name: 'type',
				type: 'options',
				options: [
					{
						name: 'User (Chat 1-1)',
						value: 0,
					},
					{
						name: 'Group (Nhóm)',
						value: 1,
					},
				],
				default: 0,
				required: true,
				description: 'Loại thread cần gửi typing event',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const zaloCred = await this.getCredentials('zaloApi');
		const cookieFromCred = JSON.parse(zaloCred.cookie as string);
		const imeiFromCred = zaloCred.imei as string;
		const userAgentFromCred = zaloCred.userAgent as string;

		const zalo = new Zalo({ imageMetadataGetter });
		api = await zalo.login({
			cookie: cookieFromCred,
			imei: imeiFromCred,
			userAgent: userAgentFromCred,
		});

		if (!api) {
			throw new NodeOperationError(this.getNode(), 'Không thể khởi tạo Zalo API');
		}

		for (let i = 0; i < items.length; i++) {
			const threadId = this.getNodeParameter('threadId', i) as string;
			const type = this.getNodeParameter('type', i) as number as ThreadType;

			const result = await api.sendTypingEvent(threadId, type);

			returnData.push({
				json: {
					success: true,
					threadId,
					type,
					result,
				},
			});
		}

		return this.prepareOutputData(returnData);
	}
}
