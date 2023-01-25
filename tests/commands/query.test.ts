import { vi, describe, it, beforeEach, expect, afterEach } from 'vitest';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { QueryItemsCommand, QueryResult } from '../../src/commands/query';
import { connect } from '../../src/mock';

type Test = {
	id: string;
	name: string;
	orgId: string;
	smth?: string;
	email?: string;
	pk?: string;
	sk?: string;
};

const mockClient = connect('eu-west-1');

const TestEntity = mockClient.defineEntity<Test>({
	name: 'TEST',
	computed: {
		pk: {
			dependsOn: ['id'],
			get: (item) => `TEST#${item.id}`,
		},
		sk: {
			dependsOn: ['email'],
			get: (item) => (item.email ? `EMAIL#${item.email}` : undefined),
		},
	},
});

const table = mockClient.defineTable({
	name: 'TestTable',
	primaryKey: 'pk',
	sortKey: 'sk',
	indexes: {
		ByEmail: {
			primaryKey: 'orgId',
			sortKey: 'email',
		},
	},
	entities: [TestEntity],
});

describe('QueryItems Command', () => {
	let cmd: QueryItemsCommand;

	const created = new Date();
	const updated = new Date();

	const items = [
		{
			id: '12345',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		},
		{
			id: '67890',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'gucio@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#67890',
			sk: 'EMAIL#gucio@acme.com',
		},
	];

	const input = {
		TableName: 'TestTable',
		KeyConditionExpression: '#pk = :pk',
		ExpressionAttributeNames: { '#pk': 'pk' },
		ExpressionAttributeValues: { ':pk': 'pk-value' },
	};

	beforeEach(() => {
		mockClient.DbClientSendMock.mockResolvedValue({
			Items: items,
		});

		cmd = new QueryItemsCommand(mockClient, table, '#pk = :pk', { pk: 'pk-value' });
	});

	afterEach(() => {
		mockClient.clearMocks();
	});

	it('Should return instance of QueryItemsCommand on creation', () => {
		expect(cmd).toBeInstanceOf(QueryItemsCommand);
	});

	it('Should send QueryCommand to the dbClient', async () => {
		await cmd.send();
		expect(mockClient.DbClientSendMock).toHaveBeenCalledTimes(1);
		expect(mockClient.DbClientSendMock.mock.lastCall![0]).toBeInstanceOf(QueryCommand);
	});

	it('Should send command and return QueryResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(QueryResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.items<Test>()).toEqual([
			{
				id: '12345',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'damian@acme.com',
				smth: 'something',
				_created: created,
				_updated: updated,
				_type: 'TEST',
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			},
			{
				id: '67890',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'gucio@acme.com',
				smth: 'something',
				_created: created,
				_updated: updated,
				_type: 'TEST',
				pk: 'TEST#67890',
				sk: 'EMAIL#gucio@acme.com',
			},
		]);
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const records = res.items<Test>()!;

		expect(records[0].pk).toBe('TEST#12345');

		records[0].id = '0987';
		expect(records[0].pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		mockClient.DbClientSendMock.mockResolvedValue({ Items: undefined });

		const res = await cmd.send();
		expect(res.items<Test>()).toEqual([]);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		mockClient.DbClientSendMock.mockResolvedValue({
			Items: [
				{
					id: '12345',
					name: 'Gucio',
					orgId: 'ACME',
					email: 'damian@acme.com',
				},
			],
		});

		const res = await cmd.send();

		expect(() => {
			res.items<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual(items);
	});

	describe('Query Expressions', () => {
		it('Should create QueryCommand with a proper input', async () => {
			await cmd.send();
			const queryCmd = mockClient.DbClientSendMock.mock.lastCall![0];

			expect(queryCmd.input).toEqual(input);
		});

		it('Should handle query with both primary and secondary index', async () => {
			const cmd = new QueryItemsCommand(mockClient, table, '#pk = :pk abd and begins_with(LEAD, :sk)', {
				pk: 'pk-value',
				sk: 'sk-value',
			});
			await cmd.send();

			const queryCmd = mockClient.DbClientSendMock.mock.lastCall![0];
			expect(queryCmd.input).toEqual({
				TableName: 'TestTable',
				KeyConditionExpression: '#pk = :pk abd and begins_with(LEAD, :sk)',
				ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
				ExpressionAttributeValues: { ':pk': 'pk-value', ':sk': 'sk-value' },
			});
		});
	});
});
