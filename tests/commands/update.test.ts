import { vi, describe, it, beforeEach, expect, afterEach } from 'vitest';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { UpdateResult, UpdateItemCommand } from '../../src/commands/update';
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

describe('UpdateItem Command', () => {
	let cmd: UpdateItemCommand;

	const created = new Date();
	const updated = new Date();

	const item = {
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
	};

	const input = {
		TableName: 'TestTable',
		Key: {
			pk: 'pk-value',
			sk: 'sk-value',
		},
		ReturnValues: 'ALL_NEW',
		UpdateExpression: 'SET #name = :name',
		ExpressionAttributeNames: { '#name': 'name' },
		ExpressionAttributeValues: { ':name': 'Gucio' },
	};

	beforeEach(() => {
		mockClient.DbClientSendMock.mockReturnValue({
			Attributes: item,
		});

		cmd = new UpdateItemCommand(
			mockClient,
			table,
			{
				pk: 'pk-value',
				sk: 'sk-value',
			},
			{
				set: { name: 'Gucio' },
			},
		);
	});

	afterEach(() => {
		mockClient.clearMocks();
	});

	it('Should return instance of UpdateItemCommand on creation', () => {
		expect(cmd).toBeInstanceOf(UpdateItemCommand);
	});

	it('Should send UpdateCommand to the dbClient', async () => {
		await cmd.send();
		expect(mockClient.DbClientSendMock).toHaveBeenCalledTimes(1);
		expect(mockClient.DbClientSendMock.mock.lastCall![0]).toBeInstanceOf(UpdateCommand);
	});

	it('Should send command and return UpdateResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(UpdateResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.item<Test>()).toEqual({
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
		});
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const record = res.item<Test>()!;

		expect(record.pk).toBe('TEST#12345');

		record.id = '0987';
		expect(record.pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		mockClient.DbClientSendMock.mockResolvedValue({ Item: undefined });

		const res = await cmd.send();
		expect(res.item<Test>()).toBe(null);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		mockClient.DbClientSendMock.mockResolvedValue({
			Attributes: {
				id: '12345',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'damian@acme.com',
			},
		});

		const res = await cmd.send();

		expect(() => {
			res.item<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual({
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
		});
	});

	describe('Update Expression', () => {
		it('Should create UpdateCommand with a simple SET input', async () => {
			await cmd.send();
			const getCmd = mockClient.DbClientSendMock.mock.lastCall![0];

			expect(getCmd.input).toEqual(input);
		});

		it('Should include two updated attributes', async () => {
			const cmd = new UpdateItemCommand(
				mockClient,
				table,
				{
					pk: 'pk-value',
					sk: 'sk-value',
				},
				{
					set: { name: 'Gucio', orgId: 'PLUM' },
				},
			);
			await cmd.send();
			const getCmd = mockClient.DbClientSendMock.mock.lastCall![0];

			expect(getCmd.input).toEqual({
				TableName: 'TestTable',
				Key: {
					pk: 'pk-value',
					sk: 'sk-value',
				},
				ReturnValues: 'ALL_NEW',
				UpdateExpression: 'SET #name = :name, #orgId = :orgId',
				ExpressionAttributeNames: { '#name': 'name', '#orgId': 'orgId' },
				ExpressionAttributeValues: { ':name': 'Gucio', ':orgId': 'PLUM' },
			});
		});

		it('Should handle field removal expression', async () => {
			const cmd = new UpdateItemCommand(
				mockClient,
				table,
				{
					pk: 'pk-value',
					sk: 'sk-value',
				},
				{
					remove: ['smth'],
				},
			);
			await cmd.send();
			const getCmd = mockClient.DbClientSendMock.mock.lastCall![0];

			expect(getCmd.input).toEqual({
				TableName: 'TestTable',
				Key: {
					pk: 'pk-value',
					sk: 'sk-value',
				},
				ReturnValues: 'ALL_NEW',
				UpdateExpression: 'REMOVE #smth',
				ExpressionAttributeNames: { '#smth': 'smth' },
				ExpressionAttributeValues: {},
			});
		});

		it('Should handle both update and removal expressions', async () => {
			const cmd = new UpdateItemCommand(
				mockClient,
				table,
				{
					pk: 'pk-value',
					sk: 'sk-value',
				},
				{
					set: { name: 'Gucio', orgId: 'PLUM' },
					remove: ['smth'],
				},
			);
			await cmd.send();
			const getCmd = mockClient.DbClientSendMock.mock.lastCall![0];

			expect(getCmd.input).toEqual({
				TableName: 'TestTable',
				Key: {
					pk: 'pk-value',
					sk: 'sk-value',
				},
				ReturnValues: 'ALL_NEW',
				UpdateExpression: 'SET #name = :name, #orgId = :orgId REMOVE #smth',
				ExpressionAttributeNames: { '#name': 'name', '#orgId': 'orgId', '#smth': 'smth' },
				ExpressionAttributeValues: { ':name': 'Gucio', ':orgId': 'PLUM' },
			});
		});
	});
});
