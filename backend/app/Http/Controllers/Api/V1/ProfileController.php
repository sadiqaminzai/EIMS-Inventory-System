<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['nullable', 'string', 'min:6', 'confirmed'],
        ]);

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->updated_by = $request->user()->id;

        if (!empty($data['password'])) {
            $user->password = bcrypt($data['password']);
            $user->must_change_password = false;
        }

        $user->save();

        return response()->json(['message' => 'Profile updated']);
    }
}
