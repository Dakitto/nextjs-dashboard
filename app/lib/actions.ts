'use server';

import {z} from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';


const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error:'Please select a customer'
    }),
    amount: z.coerce.number().gt(0,'Please enter a value greater than $0.'),
    status: z.enum(['pending','paid'],{invalid_type_error:'Please select a valid invoice status'}),
    date: z.string()
})

const CreateInvoce = FormSchema.omit({
    id:true,date:true
})

const UpdateInvoice = FormSchema.omit({ id:true, date:true });

export async function updateInvoice(id:string, prevState: State, formData: FormData){
    
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    if(!validatedFields.success){
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to create invoice.'
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    
    const amountInCents = amount * 100;
    try{
        await sql`UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
    }catch(error){
        console.error('Error updating invoice: ', error);
        return { message: 'Database Error: Failed to Update Invoice.' };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

export async function createInvoice(prevState: State, formData: FormData) {
    console.log('ESTADO DEL FORM', prevState)
    const validatedFields = CreateInvoce.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    //validamos usando el schema
    if(!validatedFields.success){
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to create invoice.'
        };
    };

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = (amount * 100);
    const date = new Date().toISOString().split('T')[0];
    

    try {
        await sql`INSERT INTO invoices (customer_id, amount, status, date) 
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date});`;
        
    } catch (error){
        console.error('Error creating invoice: ', error);
        return  { errors: error,
            message:'Error creating invoice:',
        }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');


    try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices')
    } catch(error) {
        console.error('Error deleting invoice',error);
    }
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
    try{
        await signIn('credentials',formData)
    }catch(error){
        console.log(formData)
        if(error instanceof AuthError){
            switch(error.type){
                case 'CredentialsSignin':
                    return 'Invalid Credentials. Please try again.';
                default:
                    console.log('\n\nOKISOKISOKIS')
                    console.log(error)
                    return 'Something went wrong. :)';
            }
        }
        throw error;
    }
}