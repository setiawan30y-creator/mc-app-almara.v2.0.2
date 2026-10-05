<?php

namespace App\Http\Controllers;

use App\Models\Datastore;
use App\Models\LetterNumberCounter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LetterNumberController extends Controller
{
    private const STORE_KEY = 'mc_letter_number_settings';

    public function settings()
    {
        return response()->json(['status'=>'success','data'=>$this->settingsArray()]);
    }

    public function saveSettings(Request $request)
    {
        $validated=$request->validate([
            'company_code'=>['required','string','max:20'],
            'format'=>['required','string','max:200'],
            'digits'=>['required','integer','min:1','max:10'],
            'month_format'=>[Rule::in(['short','numeric','long'])],
            'reset_mode'=>[Rule::in(['yearly','never'])],
            'letter_types'=>['required','array','min:1'],
            'letter_types.*.code'=>['required','string','max:20'],
            'letter_types.*.name'=>['required','string','max:100'],
        ]);

        $validated['company_code']=strtoupper(trim($validated['company_code']));
        $validated['letter_types']=collect($validated['letter_types'])
            ->map(fn($row)=>['code'=>strtoupper(trim($row['code'])),'name'=>trim($row['name'])])
            ->unique('code')->values()->all();

        Datastore::updateOrCreate(['store_key'=>self::STORE_KEY],['json_data'=>$validated]);
        return response()->json(['status'=>'success','data'=>$validated]);
    }

    public function next(Request $request)
    {
        $validated=$request->validate([
            'letter_type'=>['required','string','max:20'],
            'date'=>['nullable','date'],
        ]);

        $settings=$this->settingsArray();
        $company=strtoupper(trim($settings['company_code']));
        $type=strtoupper(trim($validated['letter_type']));
        $date=isset($validated['date']) ? now()->parse($validated['date']) : now();
        $year=(int)$date->year;

        $allowed=collect($settings['letter_types'])->pluck('code')->map(fn($v)=>strtoupper($v));
        if(!$allowed->contains($type)){
            return response()->json(['status'=>'error','message'=>'Jenis surat belum terdaftar.'],422);
        }

        $number=DB::transaction(function() use($company,$type,$year){
            $counter=LetterNumberCounter::query()
                ->where('company_code',$company)->where('letter_type',$type)->where('year',$year)
                ->lockForUpdate()->first();

            if(!$counter){
                $counter=LetterNumberCounter::create([
                    'company_code'=>$company,'letter_type'=>$type,'year'=>$year,'last_number'=>0
                ]);
            }

            $counter->last_number=(int)$counter->last_number+1;
            $counter->save();
            return $counter->last_number;
        });

        return response()->json(['status'=>'success','data'=>[
            'number'=>$this->formatNumber($number,$company,$type,$date,$settings),
            'sequence'=>$number,'company_code'=>$company,'letter_type'=>$type,'year'=>$year
        ]]);
    }

    private function settingsArray(): array
    {
        $store=Datastore::where('store_key',self::STORE_KEY)->first();
        $settings=$store?->json_data;
        if(is_string($settings)) $settings=json_decode($settings,true);
        $settings=is_array($settings)?$settings:[];
        return $settings+[
            'company_code'=>'MPV',
            'format'=>'{NO}/{COMPANY}/{TYPE}/{MONTH}/{YEAR}',
            'digits'=>4,
            'month_format'=>'short',
            'reset_mode'=>'yearly',
            'letter_types'=>[
                ['code'=>'SK','name'=>'Surat Keputusan'],
                ['code'=>'SPK','name'=>'Surat Perjanjian Kerja'],
                ['code'=>'INV','name'=>'Invoice'],
                ['code'=>'SKK','name'=>'Surat Keterangan'],
                ['code'=>'MEMO','name'=>'Memorandum'],
            ],
        ];
    }

    private function formatNumber(int $sequence,string $company,string $type,$date,array $settings): string
    {
        $no=str_pad((string)$sequence,max(1,(int)$settings['digits']),'0',STR_PAD_LEFT);
        $month=match($settings['month_format']){
            'numeric'=>str_pad((string)$date->month,2,'0',STR_PAD_LEFT),
            'long'=>strtolower($date->translatedFormat('F')),
            default=>strtolower($date->translatedFormat('M')),
        };

        return strtr((string)$settings['format'],[
            '{NO}'=>$no,'{COMPANY}'=>$company,'{TYPE}'=>$type,
            '{MONTH}'=>$month,'{YEAR}'=>(string)$date->year
        ]);
    }
}
