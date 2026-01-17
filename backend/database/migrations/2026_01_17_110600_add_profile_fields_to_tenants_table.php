<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('logo')->nullable()->after('name');
            $table->string('address')->nullable()->after('logo');
            $table->string('phone')->nullable()->after('address');
            $table->string('email')->nullable()->after('phone');
            $table->string('website')->nullable()->after('email');
            $table->string('license_no')->nullable()->after('website');
            $table->date('license_issue')->nullable()->after('license_no');
            $table->date('license_expiry')->nullable()->after('license_issue');
            $table->string('license_type')->nullable()->after('license_expiry');
            $table->integer('max_users')->nullable()->after('license_type');
            $table->string('license_status')->nullable()->after('max_users');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'logo',
                'address',
                'phone',
                'email',
                'website',
                'license_no',
                'license_issue',
                'license_expiry',
                'license_type',
                'max_users',
                'license_status',
            ]);
        });
    }
};
