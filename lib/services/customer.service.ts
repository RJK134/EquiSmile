import { customerRepository } from '@/lib/repositories/customer.repository';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from '@/lib/validations/customer.schema';

export const customerService = {
  async list(query: CustomerQuery) {
    return customerRepository.findMany(query);
  },

  async getById(id: string) {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new Error('Customer not found');
    return customer;
  },

  async create(data: CreateCustomerInput) {
    return customerRepository.create(data);
  },

  async update(id: string, data: UpdateCustomerInput) {
    await customerRepository.findById(id);
    return customerRepository.update(id, data);
  },

  async delete(id: string) {
    return customerRepository.delete(id);
  },

  async getActiveCount() {
    return customerRepository.count();
  },
};
